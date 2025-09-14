export interface Table {
  name: string;
  type: string;
}

export interface Column {
  cid: number;
  name: string;
  type: string;
  not_null: boolean;
  default_value: string | null;
  primary_key: boolean;
  unique: boolean;
}

export interface Row {
  [key: string]: any;
}

export interface TableData {
  columns: Column[];
  rows: Row[];
  total: number;
}

export interface InsertRequest {
  data: Record<string, any>;
}

export interface UpdateRequest {
  data: Record<string, any>;
  where: Record<string, any>;
}

export interface DeleteRequest {
  where: Record<string, any>;
}

export interface DatabaseInfo {
  filename: string;
}