import { ServiceReport, Attachment, Customer } from '../types';

// MOCK WorkDrive API
// In a real implementation, this would use axios to call Zoho WorkDrive API endpoints
// This mock stores "files" in memory/IndexedDB for demonstration

export const WORKDRIVE_ROOT_ID = '621f46285ba38c28379ecb41fe04faddbf7e9be88cab7459d4052299f5f15fc4';

const SIMULATED_DELAY = 800; // ms

// --- API SIMULATION ---

export const getNextReportId = async (year: number): Promise<string> => {
  // Simulate atomic counter fetch and update
  // REAL: fetch file 'counter.json', read, increment, write back with If-Match
  await new Promise(r => setTimeout(r, SIMULATED_DELAY));
  
  const key = `wd_counter_${year}`;
  const current = localStorage.getItem(key);
  let next = 10001;
  if (current) {
    next = parseInt(current, 10) + 1;
  }
  localStorage.setItem(key, next.toString());
  return `${year}-${next}`;
};

export const fetchCustomerDirectory = async (): Promise<Customer[]> => {
  await new Promise(r => setTimeout(r, SIMULATED_DELAY));
  // Mock data
  return [
    { id: 'c1', companyName: 'Precision Metal Works Inc.', contactPerson: 'John Smith', position: 'Maintenance Manager', address: '123 Industrial Pkwy, Cleveland, OH', phone: '555-0123' },
    { id: 'c2', companyName: 'Global Aerospace', contactPerson: 'Sarah Connor', position: 'Lead Engineer', address: '456 SkyNet Blvd, Los Angeles, CA', phone: '555-0999' },
    { id: 'c3', companyName: 'Midwest Machining', contactPerson: 'Mike Rowe', position: 'Owner', address: '789 Dirt Road, Kansas City, MO', phone: '555-4545' },
  ];
};

export const uploadFileToWorkDrive = async (
  file: File, 
  path: string, 
  onProgress: (pct: number) => void
): Promise<{ fileId: string, webUrl: string }> => {
  // Mock Upload
  const total = file.size;
  let loaded = 0;
  const step = total / 10;
  
  return new Promise((resolve, reject) => {
    // 5% chance of failure to test resilience
    if (Math.random() < 0.05) {
      setTimeout(() => reject(new Error("Network Error (Simulated)")), 500);
      return;
    }

    const interval = setInterval(() => {
      loaded += step;
      const pct = Math.min(100, Math.round((loaded / total) * 100));
      onProgress(pct);
      
      if (loaded >= total) {
        clearInterval(interval);
        resolve({
          fileId: `wd_file_${Math.random().toString(36).substr(2, 9)}`,
          webUrl: `https://workdrive.zoho.com/mock/${file.name}`
        });
      }
    }, 200);
  });
};

export const saveReportFiles = async (
  report: ServiceReport, 
  artifacts: { html: string, json: string, md: string, manifest: string, audit: string }
): Promise<void> => {
  await new Promise(r => setTimeout(r, SIMULATED_DELAY));
  // Safe access for logging
  const customerName = (report.customer && report.customer.companyName) ? report.customer.companyName : 'Unassigned Customer';
  const techName = report.technicianName || 'Unknown Tech';
  const date = report.arrivalDate || 'Unknown Date';
  console.log(`[WorkDrive] Saved artifacts for report ${report.id} to ${techName}/${customerName}/${date}`);
  // In real app: Upload each string content as a file
};