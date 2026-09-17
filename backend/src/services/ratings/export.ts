import { exportEventsForTraining, getPool } from "../../db/postgres.js";

export async function exportJsonl(): Promise<string> {
  return exportEventsForTraining(getPool());
}
