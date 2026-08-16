import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

async function createUser() {
  const isRemote =
    process.env.DB_SSL === 'true' ||
    (Boolean(process.env.DB_HOST) &&
      process.env.DB_HOST !== 'localhost' &&
      process.env.DB_HOST !== '127.0.0.1');

  // Puedes cambiar estos datos por los que tú desees
  const name = process.argv[2] || 'Admin RELAX';
  const email = process.argv[3] || 'admin@relax.com';
  const rawPassword = process.argv[4] || 'AdminRelax2024*';
  const role = (process.argv[5] || 'admin') as 'admin' | 'recepcion';

  console.log(`📡 Conectando a MySQL (${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'relax'})...`);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'relax_crm_db',
      port: Number(process.env.DB_PORT) || 3306,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    });

    console.log('🔐 Hasheando contraseña con bcrypt...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    // Verificar si el usuario ya existe
    const [existing]: any = await connection.execute('SELECT id, email FROM users WHERE email = ?', [email]);

    if (existing.length > 0) {
      console.log(`⚠️ El usuario con correo "${email}" ya existe. Actualizando contraseña y rol...`);
      await connection.execute(
        'UPDATE users SET name = ?, password = ?, role = ? WHERE email = ?',
        [name, hashedPassword, role, email]
      );
      console.log(`✅ ¡Usuario "${email}" actualizado correctamente!`);
    } else {
      await connection.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, role]
      );
      console.log(`🎉 ¡Usuario creado exitosamente!`);
    }

    console.log('--------------------------------------------------');
    console.log(`👤 Nombre:     ${name}`);
    console.log(`📧 Correo:     ${email}`);
    console.log(`🔑 Contraseña: ${rawPassword}`);
    console.log(`🛡️  Rol:        ${role}`);
    console.log('--------------------------------------------------');

    await connection.end();
  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
    process.exit(1);
  }
}

createUser();
