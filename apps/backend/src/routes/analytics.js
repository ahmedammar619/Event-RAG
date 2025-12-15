import { success, error } from '../utils/responses.js';

export default async function analyticsRoutes(fastify, options) {
  // Record analytics event (public endpoint)
  fastify.post('/track', async (request, reply) => {
    try {
      const {
        sessionId,
        userId,
        userAgent,
        deviceType,
        browser,
        os,
        referrer,
        landingPage,
        currentPage,
        screenWidth,
        screenHeight,
        language,
        utmSource,
        utmMedium,
        utmCampaign,
        eventType = 'pageview'
      } = request.body;

      // Get IP address from request
      const ipAddress = request.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || request.headers['x-real-ip']
        || request.ip;

      await fastify.db.query(
        `INSERT INTO analytics (
          session_id, user_id, ip_address, user_agent, device_type, browser, os,
          referrer, landing_page, current_page, screen_width, screen_height,
          language, utm_source, utm_medium, utm_campaign, event_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          sessionId, userId || null, ipAddress, userAgent, deviceType, browser, os,
          referrer, landingPage, currentPage, screenWidth, screenHeight,
          language, utmSource, utmMedium, utmCampaign, eventType
        ]
      );

      return success(reply, { tracked: true });
    } catch (err) {
      console.error('Analytics tracking error:', err);
      // Don't fail silently - but also don't break the user experience
      return success(reply, { tracked: false });
    }
  });

  // Get analytics data (admin only)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { days = 30, limit = 100 } = request.query;

      // Get recent analytics
      const { rows: analytics } = await fastify.db.query(
        `SELECT
          a.*,
          m.name as user_name,
          m.email as user_email
        FROM analytics a
        LEFT JOIN moderators m ON a.user_id = m.id
        WHERE a.created_at > NOW() - INTERVAL '${parseInt(days)} days'
        ORDER BY a.created_at DESC
        LIMIT $1`,
        [parseInt(limit)]
      );

      // Get summary stats
      const { rows: stats } = await fastify.db.query(
        `SELECT
          COUNT(*) as total_events,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as logged_in_users,
          COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_visits,
          COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_visits,
          COUNT(*) FILTER (WHERE device_type = 'tablet') as tablet_visits
        FROM analytics
        WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'`
      );

      // Get top pages
      const { rows: topPages } = await fastify.db.query(
        `SELECT current_page, COUNT(*) as visits
        FROM analytics
        WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY current_page
        ORDER BY visits DESC
        LIMIT 10`
      );

      // Get top referrers
      const { rows: topReferrers } = await fastify.db.query(
        `SELECT referrer, COUNT(*) as visits
        FROM analytics
        WHERE referrer IS NOT NULL AND referrer != ''
          AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY referrer
        ORDER BY visits DESC
        LIMIT 10`
      );

      // Get browsers breakdown
      const { rows: browsers } = await fastify.db.query(
        `SELECT browser, COUNT(*) as count
        FROM analytics
        WHERE browser IS NOT NULL
          AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 10`
      );

      // Get daily visits
      const { rows: dailyVisits } = await fastify.db.query(
        `SELECT DATE(created_at) as date, COUNT(*) as visits, COUNT(DISTINCT session_id) as unique_visitors
        FROM analytics
        WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC`
      );

      return success(reply, {
        analytics,
        stats: stats[0],
        topPages,
        topReferrers,
        browsers,
        dailyVisits
      });
    } catch (err) {
      console.error('Analytics fetch error:', err);
      return error(reply, 'Failed to fetch analytics', 500);
    }
  });
}
