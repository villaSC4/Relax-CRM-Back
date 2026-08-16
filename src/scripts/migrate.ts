import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function runMigration() {
  const isRemote =
    process.env.DB_SSL === 'true' ||
    (process.env.DB_HOST &&
      process.env.DB_HOST !== 'localhost' &&
      process.env.DB_HOST !== '127.0.0.1');

  const config: mysql.ConnectionOptions = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'relax_crm_db',
    port: Number(process.env.DB_PORT) || 3306,
    multipleStatements: true,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  };

  console.log(`📡 Conectando a MySQL (${config.host}:${config.port}/${config.database})...`);

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Conexión establecida con éxito.');

    const sqlFilePath = path.join(__dirname, '../../relax_crm_db.sql');
    let sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Remover CREATE DATABASE y USE para que aplique directamente en la BD seleccionada (ej. relax en Aiven)
    sql = sql.replace(/CREATE DATABASE[\s\S]*?;/gi, '');
    sql = sql.replace(/USE\s+[\w`]+;/gi, '');

    console.log('⏳ Ejecutando script de creación de tablas y servicios iniciales...');
    await connection.query(sql);

    console.log('🎉 Migración completada exitosamente. Las tablas y datos iniciales están listos en MySQL.');
    await connection.end();
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

runMigration();
