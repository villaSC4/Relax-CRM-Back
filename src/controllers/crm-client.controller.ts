import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

export class CRMClientController {
  static async getAllClients(req: Request, res: Response) {
    try {
      const [clients] = await pool.query<RowDataPacket[]>(`
        SELECT 
          c.id,
          c.full_name,
          c.phone,
          c.email,
          c.notes,
          c.created_at,
          COUNT(a.id) AS total_appointments
        FROM clients c
        LEFT JOIN appointments a ON c.id = a.client_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);

      return res.status(200).json({ success: true, data: clients });
    } catch (error) {
      console.error('Error al obtener clientes:', error);
      return res.status(500).json({ success: false, message: 'Error al consultar directorio de clientes' });
    }
  }

  static async updateNotes(req: Request, res: Response) {
    try {
      const clientId = Number(req.params.id);
      const { notes } = req.body;

      await pool.query('UPDATE clients SET notes = ? WHERE id = ?', [notes, clientId]);

      return res.status(200).json({ success: true, message: 'Notas actualizadas correctamente' });
    } catch (error) {
      console.error('Error al actualizar notas:', error);
      return res.status(500).json({ success: false, message: 'Error al guardar notas del cliente' });
    }
  }
}
