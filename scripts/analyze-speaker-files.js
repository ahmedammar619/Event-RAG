import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const PDF_DIR = './data/Speaker-PDFs';

async function analyze() {
  // Get all speakers from DB
  const result = await pool.query('SELECT id, name FROM speakers ORDER BY name');
  const speakers = result.rows;

  // Get all PDF files
  const pdfFiles = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));

  console.log('=== SPEAKER FILE MAPPING ANALYSIS ===\n');
  console.log(`Database speakers: ${speakers.length}`);
  console.log(`PDF files: ${pdfFiles.length}`);

  // Files to exclude (not speaker files)
  const excludeFiles = [
    '(_Blank (DO NOT USE)_.pdf',
    'ICE Session.pdf',
    'ISPU Session Sessions.pdf',
    'Khalil Center 2025.pdf'
  ];

  // Duplicates (Updated versions) - map to preferred file
  const duplicates = {
    '(Updated) Esam Omeish (FINAL)_.pdf': 'Esam Omeish',
    '(Updated) Işık Ercan (FINAL).pdf': 'Işık Ercan',
    '(Updated) Lobna Mulla (FINAL).pdf': 'Lobna Mulla',
    '(Updated) Mohammad Elshinawy (DONE).pdf': null, // Not in DB
    '(Updated) of Ayman Hammous (FINAL).pdf': null, // Not in DB (Ayman Hammous)
    'Esam Omeish (FINAL)_.pdf': null, // Use Updated version
    'Işık Ercan (FINAL).pdf': null, // Use Updated version
    'Malik Hassan (FINAL)(1).pdf': null, // Duplicate
    'Ayman Hammous (FINAL).pdf': null, // Not in DB
  };

  const mapping = [];
  const unmatchedFiles = [];
  const unmatchedSpeakers = [];

  // Extract speaker name from filename
  function extractName(filename) {
    let name = filename.replace('.pdf', '');
    // Remove common suffixes
    name = name.replace(/\s*\(FINAL\)\s*_?$/i, '');
    name = name.replace(/\s*\(DONE\)\s*_?$/i, '');
    name = name.replace(/\s*\(UPDATED\)\s*_?$/i, '');
    name = name.replace(/\s*\(joint\)\s*$/i, '');
    name = name.replace(/\s*\(Needs Youth\)\s*$/i, '');
    name = name.replace(/-Convention\s*$/i, '');
    name = name.replace(/- Convention\s*$/i, '');
    name = name.replace(/\s*\(\d+\)$/, ''); // Remove (1) etc
    name = name.replace(/^\(Updated\)\s*(of\s+)?/i, ''); // Remove (Updated) prefix
    return name.trim();
  }

  // Create a map for fuzzy matching
  const speakerMap = new Map();
  speakers.forEach(s => {
    speakerMap.set(s.name.toLowerCase(), s);
    // Also map without titles
    const noTitle = s.name.replace(/^Dr\.\s*/i, '').toLowerCase();
    if (noTitle !== s.name.toLowerCase()) {
      speakerMap.set(noTitle, s);
    }
  });

  // Process each PDF file
  for (const file of pdfFiles) {
    if (excludeFiles.includes(file)) continue;
    if (duplicates[file] !== undefined) {
      if (duplicates[file] === null) continue; // Skip this file
    }

    const extractedName = extractName(file);
    const speaker = speakerMap.get(extractedName.toLowerCase());

    if (speaker) {
      mapping.push({
        speakerId: speaker.id,
        speakerName: speaker.name,
        filename: file,
        extractedName
      });
    } else {
      unmatchedFiles.push({ file, extractedName });
    }
  }

  // Find speakers without files
  const matchedSpeakerIds = new Set(mapping.map(m => m.speakerId));
  for (const speaker of speakers) {
    if (!matchedSpeakerIds.has(speaker.id)) {
      unmatchedSpeakers.push(speaker);
    }
  }

  console.log('\n=== MATCHED SPEAKERS ===');
  console.log(`Successfully matched: ${mapping.length} speakers to files\n`);
  mapping.forEach(m => {
    console.log(`  ✓ ${m.speakerName} → ${m.filename}`);
  });

  console.log('\n=== UNMATCHED FILES (no speaker in DB) ===');
  console.log(`Files without matching speaker: ${unmatchedFiles.length}\n`);
  unmatchedFiles.forEach(f => {
    console.log(`  ✗ ${f.file} (extracted: "${f.extractedName}")`);
  });

  console.log('\n=== SPEAKERS WITHOUT FILES ===');
  console.log(`Speakers without files: ${unmatchedSpeakers.length}\n`);
  unmatchedSpeakers.forEach(s => {
    console.log(`  - ${s.name} (id: ${s.id})`);
  });

  console.log('\n=== EXCLUDED FILES (not speaker files) ===');
  excludeFiles.forEach(f => console.log(`  - ${f}`));

  console.log('\n=== SUMMARY ===');
  console.log(`Total speakers in DB: ${speakers.length}`);
  console.log(`Total PDF files: ${pdfFiles.length}`);
  console.log(`Excluded files: ${excludeFiles.length}`);
  console.log(`Speakers matched to files: ${mapping.length}`);
  console.log(`Unmatched files: ${unmatchedFiles.length}`);
  console.log(`Speakers without files: ${unmatchedSpeakers.length}`);

  await pool.end();

  return { mapping, unmatchedFiles, unmatchedSpeakers };
}

analyze().catch(console.error);
