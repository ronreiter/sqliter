import axios from 'axios';
import { Table, Column, TableData, InsertRequest, UpdateRequest, DeleteRequest, DatabaseInfo } from './types';

const API_BASE = '/api';

export const api = {
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const response = await axios.get(`${API_BASE}/info`);
    return response.data;
  },

  async getTables(): Promise<Table[]> {
    const response = await axios.get(`${API_BASE}/tables`);
    return response.data.tables;
  },

  async getTableSchema(tableName: string): Promise<Column[]> {
    const response = await axios.get(`${API_BASE}/tables/${tableName}/schema`);
    return response.data.columns;
  },

  async getTableData(tableName: string, limit = 100, offset = 0, sortColumn?: string, sortDirection?: 'asc' | 'desc'): Promise<TableData> {
    const params: any = { limit, offset };
    if (sortColumn && sortDirection) {
      params.sort_column = sortColumn;
      params.sort_direction = sortDirection;
    }
    const response = await axios.get(`${API_BASE}/tables/${tableName}/data`, {
      params
    });
    return response.data;
  },

  async insertRow(tableName: string, data: Record<string, any>): Promise<void> {
    const request: InsertRequest = { data };
    await axios.post(`${API_BASE}/tables/${tableName}/rows`, request);
  },

  async updateRow(tableName: string, data: Record<string, any>, where: Record<string, any>): Promise<void> {
    const request: UpdateRequest = { data, where };
    await axios.put(`${API_BASE}/tables/${tableName}/rows`, request);
  },

  async deleteRow(tableName: string, where: Record<string, any>): Promise<void> {
    const request: DeleteRequest = { where };
    await axios.delete(`${API_BASE}/tables/${tableName}/rows`, { data: request });
  },
};