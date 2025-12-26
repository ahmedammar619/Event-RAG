import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

async function clearR2Speakers() {
  // List all objects in speakers/
  const listCmd = new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME,
    Prefix: 'speakers/'
  });

  const response = await s3Client.send(listCmd);

  if (!response.Contents || response.Contents.length === 0) {
    console.log('No files in speakers/ folder');
    return;
  }

  console.log('Found', response.Contents.length, 'files to delete:');
  response.Contents.forEach(obj => console.log(' -', obj.Key));

  // Delete all objects
  const deleteCmd = new DeleteObjectsCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Delete: {
      Objects: response.Contents.map(obj => ({ Key: obj.Key }))
    }
  });

  await s3Client.send(deleteCmd);
  console.log('\nDeleted all files from speakers/ folder');
}

clearR2Speakers().catch(console.error);
