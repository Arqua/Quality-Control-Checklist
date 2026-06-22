import { promises as fs } from 'fs';
import path from 'path';

/**
 * Object-storage abstraction for inspection photos.
 *
 * Uploads to an S3 bucket when AWS credentials + bucket are configured;
 * otherwise falls back to the local `uploads/` directory so the app works in
 * development without cloud infrastructure. The AWS SDK is imported lazily so
 * it is only required when actually used.
 */

const LOCAL_DIR = path.join(process.cwd(), 'uploads');

export interface StoredObject {
  url: string;
  key: string;
}

function s3Configured(): boolean {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

async function putToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<StoredObject> {
  // Lazy import keeps @aws-sdk/client-s3 optional for local/dev deployments.
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.AWS_S3_BUCKET as string;

  const client = new S3Client({ region });
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  const url =
    process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/+$/, '')
      ? `${process.env.AWS_S3_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  return { url, key };
}

async function putToLocal(key: string, body: Buffer): Promise<StoredObject> {
  const dest = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, body);
  const base = (process.env.LOCAL_UPLOAD_BASE_URL || '/uploads').replace(/\/+$/, '');
  return { url: `${base}/${key}`, key };
}

/**
 * Persists a photo and returns its retrievable URL.
 */
export async function storePhoto(
  key: string,
  body: Buffer,
  contentType = 'image/jpeg'
): Promise<StoredObject> {
  return s3Configured()
    ? putToS3(key, body, contentType)
    : putToLocal(key, body);
}
