import XLSX from 'xlsx';
import { success } from '../utils/responses.js';

// Helper to format time values from database
const formatTime = (time) => {
  if (!time) return '';
  if (typeof time === 'string') return time.slice(0, 5);
  // Handle time objects
  if (time.hours !== undefined) {
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes || 0).padStart(2, '0')}`;
  }
  return String(time).slice(0, 5);
};

export default async function exportRoutes(fastify, options) {
  const { db, ragDb } = fastify;

  // GET /api/export/headcount-report - Export merged headcount data as Excel
  fastify.get('/headcount-report', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
    // Get sessions from main DB with all related data
    const mainDbSessions = await db.query(`
      SELECT
        s.id,
        s.name,
        s.start_time,
        s.end_time,
        s.headcount as main_headcount,
        s.headcount_percentage as main_headcount_percentage,
        s.speaker,
        s.moderators_needed,
        ed.date,
        r.name as room_name,
        r.capacity as room_capacity,
        COALESCE(
          (SELECT json_agg(json_build_object('name', m.name, 'email', m.email, 'phone', m.phone))
           FROM assignments a
           JOIN moderators m ON a.moderator_id = m.id
           WHERE a.session_id = s.id),
          '[]'
        ) as assigned_moderators
      FROM sessions s
      LEFT JOIN event_days ed ON s.event_day_id = ed.id
      LEFT JOIN rooms r ON s.room_id = r.id
      ORDER BY ed.date, s.start_time, r.name
    `);

    // Get sessions from RAG DB with headcount data (if available)
    let ragDbSessions = { rows: [] };
    if (ragDb) {
      try {
        ragDbSessions = await ragDb.query(`
          SELECT
            id,
            title,
            date,
            time_start,
            time_end,
            room,
            speakers,
            headcount as rag_headcount,
            headcount_percentage as rag_headcount_percentage,
            room_capacity,
            track,
            session_type
          FROM sessions
          ORDER BY date, time_start
        `);
      } catch (ragError) {
        fastify.log.warn('RAG database query failed:', ragError.message);
      }
    } else {
      fastify.log.warn('RAG database not available, exporting main DB data only');
    }

    // Create a map of RAG sessions by title for quick lookup
    const ragSessionMap = new Map();
    for (const session of ragDbSessions.rows) {
      // Normalize title for matching
      const normalizedTitle = session.title?.toLowerCase().trim();
      if (normalizedTitle) {
        ragSessionMap.set(normalizedTitle, session);
      }
    }

    // Merge data - prioritize main DB headcount, fall back to RAG DB
    const mergedData = mainDbSessions.rows.map(session => {
      const normalizedName = session.name?.toLowerCase().trim();
      const ragSession = ragSessionMap.get(normalizedName);

      // Determine final headcount values
      // Priority: main DB > RAG DB
      let finalHeadcount = null;
      let finalHeadcountPercentage = null;
      let headcountSource = 'none';

      if (session.main_headcount !== null) {
        finalHeadcount = session.main_headcount;
        headcountSource = 'main_db';
      } else if (ragSession?.rag_headcount !== null) {
        finalHeadcount = ragSession.rag_headcount;
        headcountSource = 'rag_db';
      }

      if (session.main_headcount_percentage !== null) {
        finalHeadcountPercentage = session.main_headcount_percentage;
        headcountSource = 'main_db';
      } else if (ragSession?.rag_headcount_percentage !== null) {
        finalHeadcountPercentage = ragSession.rag_headcount_percentage;
        headcountSource = headcountSource === 'main_db' ? 'main_db' : 'rag_db';
      }

      // Calculate estimated headcount from percentage if available
      const roomCapacity = session.room_capacity || ragSession?.room_capacity;
      let estimatedHeadcount = null;
      if (finalHeadcountPercentage !== null && roomCapacity) {
        estimatedHeadcount = Math.round((finalHeadcountPercentage / 100) * roomCapacity);
      }

      // Parse assigned moderators
      const moderators = typeof session.assigned_moderators === 'string'
        ? JSON.parse(session.assigned_moderators)
        : session.assigned_moderators;

      return {
        'Session Name': session.name,
        'Date': session.date ? new Date(session.date).toISOString().split('T')[0] : '',
        'Start Time': formatTime(session.start_time),
        'End Time': formatTime(session.end_time),
        'Room': session.room_name || '',
        'Room Capacity': roomCapacity || '',
        'Speaker(s)': session.speaker || ragSession?.speakers || '',
        'Track': ragSession?.track || '',
        'Headcount (Exact)': finalHeadcount || '',
        'Headcount (%)': finalHeadcountPercentage !== null ? `${finalHeadcountPercentage}%` : '',
        'Estimated Attendance': estimatedHeadcount || finalHeadcount || '',
        'Headcount Source': headcountSource,
        'Moderators Needed': session.moderators_needed,
        'Moderators Assigned': moderators?.length || 0,
        'Assigned Moderator Names': moderators?.map(m => m.name).join('; ') || '',
        'Assigned Moderator Emails': moderators?.map(m => m.email).join('; ') || '',
        'Assigned Moderator Phones': moderators?.map(m => m.phone).filter(Boolean).join('; ') || ''
      };
    });

    // Also include RAG-only sessions (sessions in RAG DB but not in main DB)
    const mainSessionNames = new Set(mainDbSessions.rows.map(s => s.name?.toLowerCase().trim()));
    const ragOnlySessions = ragDbSessions.rows
      .filter(s => !mainSessionNames.has(s.title?.toLowerCase().trim()))
      .map(session => {
        const roomCapacity = session.room_capacity;
        let estimatedHeadcount = null;
        if (session.rag_headcount_percentage !== null && roomCapacity) {
          estimatedHeadcount = Math.round((session.rag_headcount_percentage / 100) * roomCapacity);
        }

        return {
          'Session Name': session.title,
          'Date': session.date ? new Date(session.date).toISOString().split('T')[0] : '',
          'Start Time': formatTime(session.time_start),
          'End Time': formatTime(session.time_end),
          'Room': session.room || '',
          'Room Capacity': roomCapacity || '',
          'Speaker(s)': session.speakers || '',
          'Track': session.track || '',
          'Headcount (Exact)': session.rag_headcount || '',
          'Headcount (%)': session.rag_headcount_percentage !== null ? `${session.rag_headcount_percentage}%` : '',
          'Estimated Attendance': estimatedHeadcount || session.rag_headcount || '',
          'Headcount Source': session.rag_headcount !== null || session.rag_headcount_percentage !== null ? 'rag_db' : 'none',
          'Moderators Needed': '',
          'Moderators Assigned': 0,
          'Assigned Moderator Names': '',
          'Assigned Moderator Emails': '',
          'Assigned Moderator Phones': ''
        };
      });

    // Combine all data
    const allData = [...mergedData, ...ragOnlySessions];

    // Sort by date and time
    allData.sort((a, b) => {
      if (a['Date'] !== b['Date']) {
        return a['Date'].localeCompare(b['Date']);
      }
      return a['Start Time'].localeCompare(b['Start Time']);
    });

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();

    // Main data sheet
    const worksheet = XLSX.utils.json_to_sheet(allData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 50 },  // Session Name
      { wch: 12 },  // Date
      { wch: 10 },  // Start Time
      { wch: 10 },  // End Time
      { wch: 25 },  // Room
      { wch: 12 },  // Room Capacity
      { wch: 40 },  // Speaker(s)
      { wch: 15 },  // Track
      { wch: 15 },  // Headcount (Exact)
      { wch: 12 },  // Headcount (%)
      { wch: 18 },  // Estimated Attendance
      { wch: 15 },  // Headcount Source
      { wch: 15 },  // Moderators Needed
      { wch: 18 },  // Moderators Assigned
      { wch: 40 },  // Assigned Moderator Names
      { wch: 40 },  // Assigned Moderator Emails
      { wch: 30 },  // Assigned Moderator Phones
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Headcount Report');

    // Create summary sheet
    const summary = [
      { Metric: 'Total Sessions', Value: allData.length },
      { Metric: 'Sessions with Headcount Data', Value: allData.filter(s => s['Headcount (Exact)'] || s['Headcount (%)']).length },
      { Metric: 'Sessions without Headcount', Value: allData.filter(s => !s['Headcount (Exact)'] && !s['Headcount (%)']).length },
      { Metric: 'Data from Main DB', Value: allData.filter(s => s['Headcount Source'] === 'main_db').length },
      { Metric: 'Data from RAG DB', Value: allData.filter(s => s['Headcount Source'] === 'rag_db').length },
      { Metric: 'Total Estimated Attendance', Value: allData.reduce((sum, s) => sum + (parseInt(s['Estimated Attendance']) || 0), 0) },
      { Metric: 'Report Generated', Value: new Date().toISOString() },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summary);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Send as file download
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="headcount_report_${new Date().toISOString().split('T')[0]}.xlsx"`)
      .send(excelBuffer);
    } catch (error) {
      fastify.log.error('Headcount report error:', error);
      throw error;
    }
  });

  // GET /api/export/headcount-stats - Get quick stats for the export section
  fastify.get('/headcount-stats', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Get counts from main DB
    const mainStats = await db.query(`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN headcount IS NOT NULL OR headcount_percentage IS NOT NULL THEN 1 END) as with_headcount
      FROM sessions
    `);

    // Get counts from RAG DB (if available)
    let ragStats = { rows: [{ total_sessions: 0, with_headcount: 0 }] };
    if (ragDb) {
      try {
        ragStats = await ragDb.query(`
          SELECT
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN headcount IS NOT NULL OR headcount_percentage IS NOT NULL THEN 1 END) as with_headcount
          FROM sessions
        `);
      } catch (error) {
        fastify.log.warn('RAG database query failed for stats:', error.message);
      }
    }

    return success({
      main_db: {
        total: parseInt(mainStats.rows[0].total_sessions),
        with_headcount: parseInt(mainStats.rows[0].with_headcount)
      },
      rag_db: {
        total: parseInt(ragStats.rows[0].total_sessions),
        with_headcount: parseInt(ragStats.rows[0].with_headcount)
      }
    });
  });
}
