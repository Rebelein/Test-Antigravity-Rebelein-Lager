
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';

const execPromise = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

// Load .env file manually
const envPath = path.join(rootDir, '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, ''); // Remove quotes
            envVars[key] = value;
        }
    });
}

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || envVars.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;
const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING || envVars.PG_CONNECTION_STRING;

// Setup paths
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDirName = `supabase_backup_${timestamp}`;
const backupPath = path.join(rootDir, backupDirName);
const dbDumpPath = path.join(backupPath, 'db_dump.sql');
const storagePath = path.join(backupPath, 'storage');

async function main() {
    console.log('--- Starting Supabase Backup ---');

    // Validation
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
        console.error('Please ensure they are set in your .env file.');
        process.exit(1);
    }

    // Create Backup Directory
    if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
    }
    fs.mkdirSync(backupPath, { recursive: true });
    fs.mkdirSync(storagePath, { recursive: true });

    // 1. Database Backup
    if (PG_CONNECTION_STRING) {
        console.log('Starting Database Dump...');
        try {
            // Check if pg_dump is available
            await execPromise('pg_dump --version');

            // Run pg_dump
            // We wrap the connection string in quotes to handle special characters
            const cmd = `pg_dump "${PG_CONNECTION_STRING}" -f "${dbDumpPath}"`;
            await execPromise(cmd);
            console.log(`Database dumped to ${dbDumpPath}`);
        } catch (error) {
            console.error('Database dump failed:', error.message);
            console.error('Ensure pg_dump is installed and in your PATH, and the connection string is correct.');
        }
    } else {
        console.warn('Skipping Database Dump: PG_CONNECTION_STRING not found in .env');
    }

    // 2. Storage Backup
    console.log('Starting Storage Backup...');
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) throw bucketsError;

        for (const bucket of buckets) {
            console.log(`Downloading bucket: ${bucket.name}`);
            const bucketDir = path.join(storagePath, bucket.name);
            fs.mkdirSync(bucketDir, { recursive: true });

            // List all files (naive implementation, assumes < 1000 files per folder structure for simplicity)
            // For robust recursive listing, we'd need a helper. Here we implement a recursive lister.
            await downloadFolder(supabase, bucket.name, '', bucketDir);
        }
        console.log('Storage backup complete.');
    } catch (error) {
        console.error('Storage backup failed:', error.message);
    }

    // 3. Zip
    console.log('Zipping backup...');
    const zipFileName = `${backupDirName}.zip`;
    const zipPath = path.join(rootDir, zipFileName);

    try {
        // Windows: Use PowerShell Compress-Archive
        // Linux/Mac: Use zip -r (implementation below assumes user is on Windows per context)
        // We use a safe PowerShell command
        const psCommand = `powershell -Command "Compress-Archive -Path '${backupPath}' -DestinationPath '${zipPath}' -Force"`;
        await execPromise(psCommand);
        console.log(`Backup zipped to: ${zipPath}`);

        // Cleanup
        console.log('Cleaning up temporary files...');
        fs.rmSync(backupPath, { recursive: true, force: true });
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Zipping failed:', error.message);
        console.log(`Backup folder left at: ${backupPath}`);
    }

    console.log('--- Backup Finished ---');
}

async function downloadFolder(supabase, bucket, folderPath, localDir) {
    const { data: items, error } = await supabase.storage.from(bucket).list(folderPath, { limit: 1000 });
    if (error) {
        console.error(`Error listing ${bucket}/${folderPath}:`, error.message);
        return;
    }

    for (const item of items) {
        // Check if it's a folder (no id usually implies folder in Supabase storage list)
        if (!item.id) {
            // It is a folder
            const newFolderPath = folderPath ? `${folderPath}/${item.name}` : item.name;
            const newLocalDir = path.join(localDir, item.name);
            fs.mkdirSync(newLocalDir, { recursive: true });
            await downloadFolder(supabase, bucket, newFolderPath, newLocalDir);
        } else {
            // It is a file
            const filePath = folderPath ? `${folderPath}/${item.name}` : item.name;
            const localFilePath = path.join(localDir, item.name);

            try {
                const { data, error: dlError } = await supabase.storage.from(bucket).download(filePath);
                if (dlError) throw dlError;

                if (data) {
                    const buffer = Buffer.from(await data.arrayBuffer());
                    fs.writeFileSync(localFilePath, buffer);
                }
            } catch (e) {
                console.error(`Failed to download ${filePath}:`, e.message);
            }
        }
    }
}

main();
