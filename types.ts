
export type UserRole = 'ADMIN' | 'USER' | 'SUPER_ADMIN';

export interface User {
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
}

export interface Attachment {
  id: string;
  fileId?: string; // WorkDrive File ID
  fileName: string;
  fileType: string;
  size: number;
  url?: string; // WebLink (remote) or Object URL (transient)
  data?: string; // Base64 Data URI for local persistence and HTML embedding
  path?: string; // WorkDrive path
  bucket: 'summary' | 'issue_photos' | 'created_media' | 'received_media' | 'wechat' | 'old_backup' | 'new_backup' | 'parts' | 'other';
  uploaded: boolean;
  uploading: boolean;
  error?: string;
  issueId?: string; // If attached to a specific issue
  caption?: string; // For photos
  fieldRef?: string; // ID of the specific field (e.g., 'rootCause', 'fixItem-123')
}

export interface PartEntry {
  id: string;
  partNumber: string;
  description: string;
  quantity: string;
  notes: string;
  type: 'used' | 'needed' | 'waiting';
}

export interface Issue {
  id: string;
  title: string;
  category: string; // e.g., 'Electrical', 'Mechanical'
  resolved: boolean;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  
  // Details
  description: string; // Observation
  proposedFixes: { id: string; text: string; }[];
  troubleshootingSteps: { id: string; text: string; }[];
  
  // Resolution (if resolved)
  rootCause: string;
  fixApplied: string;
  verifiedBy: string;
  notes: string;
  solutionSummary: string; // Rich text summary

  // Content
  attachments: Attachment[];
  parts: PartEntry[];

  // Meta
  addToMfgReport: boolean;
  followUpRequired: boolean;
}

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  position: string;
  address: string;
  phone: string;
}

export interface ServiceReport {
  id: string; // UUID for internal tracking
  reportId?: string; // <YYYY>-<Counter> assigned on sync
  status: 'DRAFT' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
  createdBy: string; // email
  technicianName: string;
  
  // Dates
  arrivalDate: string;
  departureDate: string;

  // Service Type
  serviceTypes: string[];

  // Customer
  customer: Customer;

  // Machine
  machine: {
    serialNumber: string;
    modelNumber: string;
    machineType: string;
    controllerType: string;
    softwareVersion: string;
  };

  // Content
  summary: string;
  attachments: Attachment[]; // Report-level attachments (summary photos, nameplates)
  issues: Issue[];
  
  // Parts
  parts: PartEntry[];

  // Other
  followUpRequired: boolean;
  designSuggestion: { current: string; problem: string; change: string; };
  internalSuggestion: string;
  toolsBought: { id: string; text: string; }[];
  toolsUsed: { id: string; text: string; }[];
  newNameplates: { id: string; text: string; }[];

  // Sync State (not part of JSON export)
  _syncState?: {
    lastSaved: string;
    dirty: boolean;
    uploadQueue: string[]; // IDs of attachments pending upload
    version: number; // For conflict resolution
    isOffline: boolean;
  };
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: 'FIELD_CHANGE' | 'FILE_UPLOAD' | 'SAVE_DRAFT' | 'COMPLETE' | 'CREATE_EDITED_VERSION' | 'ERROR' | 'RETRY_UPLOAD';
  fieldPath?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: any;
}

export const JOB_TYPES = [
  'Installation / Commissioning',
  'Preventive Maintenance',
  'Warranty Repair',
  'Billable Repair',
  'Training',
  'Retrofit',
  'Remote Support'
];

export const ISSUE_CATEGORIES = [
  'Not Specified',
  'Mechanical',
  'Electrical',
  'Software/Control',
  'Hydraulic',
  'Pneumatic',
  'Operator Error',
  'Process/Application'
];