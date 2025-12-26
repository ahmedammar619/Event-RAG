import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const PDF_DIR = './data/Speaker-PDFs';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://media.vewoz.com';

// Manual mapping of speaker names to their preferred PDF file
const speakerToFile = {
  'Abdelnasser Rashid': 'Abdelnasser Rashid (FINAL).pdf',
  'Abdool Rahman Khan': 'Abdool Rahman Khan (FINAL)_.pdf',
  'Ahmed Ghanim': 'Ahmed Ghanim (DONE).pdf',
  'Altaf Husain': 'Altaf Husain (FINAL)_.pdf',
  'Ammar Alshukry': 'Ammar Alshukry (FINAL).pdf',
  'Dalia Mogahed': 'Dalia Mogahed (FINAL).pdf',
  'Dr. Hamed Ghazali': 'Hamed Ghazali (FINAL).pdf',
  'Duaa Haggag': 'Duaa Haggag (FINAL).pdf',
  'Esam Omeish': '(Updated) Esam Omeish (FINAL)_.pdf',
  'Fuad Mohamed': 'Fuad Mohamed (UPDATED).pdf',
  'Hadia Zarzour': 'Hadia Zarzour (FINAL).pdf',
  'Ieasha Prime': 'Ieasha Prime (FINAL).pdf',
  'Ihsan Bagby': 'Ihsan Bagby (FINAL).pdf',
  'Işık Ercan': '(Updated) Işık Ercan (FINAL).pdf',
  'Kifah Mustapha': 'Kifah Mustapha-Convention (FINAL).pdf',
  'Lobna Mulla': '(Updated) Lobna Mulla (FINAL).pdf',
  'Margari Hill': 'Margari Hill (FINAL).pdf',
  'Marwa Al-Qudah': 'Marwa Al-Qudah (DONE).pdf',
  'Meryem Göka': 'Meryem Göka (FINAL).pdf',
  'Mohamed AbuTaleb': 'Mohamed Abutaleb (FINAL).pdf',
  'Mohammad Badawy': 'Mohammad Badawy (FINAL).pdf',
  'Nadeem Siddiqi': 'Nadeem Siddiqi (FINAL).pdf',
  'Nihad Awad': 'Nihad Awad (FINAL).pdf',
  'Omar Hedroug': 'Omar Hedroug (FINAL).pdf',
  'Osama Abu Irshaid': 'Osama Abu Irshaid (FINAL).pdf',
  'Rami Bleibel': 'Rami Bleibel (FINAL).pdf',
  'Rümeysa Kadak': 'Rümeysa Kadak (FINAL).pdf',
  'Saad Kazmi': 'Saad Kazmi (FINAL).pdf',
  'Sabeel Ahmed': 'Sabeel Ahmed (FINAL).pdf',
  'Sameera Ahmed': 'Sameera Ahmed (FINAL).pdf',
  'Sawsan Jaber': 'Sawsan Jaber (FINAL).pdf',
  'Shereef Akeel': 'Shereef Akeel (DONE)_.pdf',
  'Siraj Wahhaj': 'Siraj Wahhaj (FINAL).pdf',
  'Suhaib Webb': 'Suhaib Webb-Convention (FINAL).pdf',
  'Suhail Mulla': 'Suhail Mulla (FINAL).pdf',
  'Yaser Birjas': 'Yaser Birjas (FINAL).pdf',
  'Zaynab Ansari': 'Zaynab Ansari -Convention (FINAL).pdf',
};

async function uploadAndUpdate() {
  console.log('=== UPLOADING SPEAKER FILES TO R2 ===\n');

  let uploaded = 0;
  let failed = 0;
  let notFound = 0;

  for (const [speakerName, filename] of Object.entries(speakerToFile)) {
    const filePath = path.join(PDF_DIR, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`  ✗ File not found: ${filename}`);
      notFound++;
      continue;
    }

    try {
      // Read file
      const fileContent = fs.readFileSync(filePath);

      // Create a clean filename for R2
      const r2Key = `speakers/${filename}`;

      // Upload to R2
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        Body: fileContent,
        ContentType: 'application/pdf'
      }));

      // Create public URL
      const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`;
      const encodedUrl = `${R2_PUBLIC_URL}/speakers/${encodeURIComponent(filename)}`;

      // Update database
      const result = await pool.query(
        'UPDATE speakers SET file_url = $1 WHERE name = $2 RETURNING id',
        [encodedUrl, speakerName]
      );

      if (result.rowCount > 0) {
        console.log(`  ✓ ${speakerName} → ${filename}`);
        uploaded++;
      } else {
        console.log(`  ⚠ ${speakerName} - uploaded but not found in DB`);
      }
    } catch (err) {
      console.log(`  ✗ ${speakerName}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Uploaded and updated: ${uploaded}`);
  console.log(`Files not found: ${notFound}`);
  console.log(`Failed: ${failed}`);

  await pool.end();
}

uploadAndUpdate().catch(console.error);
