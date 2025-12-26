import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || ''; // In a real app, ensure this is set securely or via backend proxy
const ai = new GoogleGenAI({ apiKey });

export const analyzeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Analyze this image in the context of a technical service report for industrial CNC machinery. Describe what you see, identifying components and any visible damage or anomalies. Keep it concise." }
        ]
      }
    });
    return response.text || "Could not analyze image.";
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    return "Error analyzing image.";
  }
};

export const extractMachineInfoFromImage = async (base64Data: string, mimeType: string): Promise<{ serialNumber?: string, modelNumber?: string, machineType?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Extract the following machine information from this nameplate image into a JSON object: 'serialNumber', 'modelNumber', 'machineType' (from Machine Name). If a field is not found, leave it empty." }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return {};
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Nameplate Extraction Error:", error);
    return {};
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    // Convert Blob to Base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Good for fast audio transcription
            contents: {
              parts: [
                { inlineData: { mimeType: audioBlob.type, data: base64data } },
                { text: "Transcribe this audio note accurately." }
              ]
            }
          });
          resolve(response.text || "");
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
    });
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    return "";
  }
};

export const generateSolutionSummary = async (rootCause: string, fix: string, notes: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
        Context: Industrial Service Report.
        Root Cause: ${rootCause}
        Fix Applied: ${fix}
        Additional Notes: ${notes}
        
        Task: Generate a professional "Solution Summary" paragraph based on the fields above. 
        It should be written in past tense, technical but clear, suitable for a customer to read.
      `,
      config: {
        thinkingConfig: { thinkingBudget: 2048 } // Small budget for reasoning
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Summary Gen Error:", error);
    return "";
  }
};

export const getCoordinatesForAddress = async (address: string): Promise<{lat: number, lng: number} | null> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Find the latitude and longitude for this address: "${address}". Return the result as a valid JSON object with keys "lat" and "lng". Do not include markdown formatting.`,
            config: {
                tools: [{ googleMaps: {} }],
                // responseMimeType: 'application/json' // Not supported with googleMaps tool
            }
        });
        
        const text = response.text || "";
        // Clean up potential markdown code blocks
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Attempt to parse JSON from the text
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        return null;
    } catch (e) {
        console.error("Map grounding error", e);
        return null;
    }
}

// Helper to generate photo attachments
const makePhoto = (id: string, bucket: string, fieldRef?: string, state: 'uploaded' | 'uploading' | 'error' = 'uploaded') => ({
    id,
    fileName: `photo_${id}.jpg`,
    fileType: 'image/jpeg',
    size: 245000 + Math.floor(Math.random() * 100000),
    url: `https://picsum.photos/seed/${id}/800/600`,
    bucket,
    fieldRef,
    uploaded: state === 'uploaded',
    uploading: state === 'uploading',
    error: state === 'error' ? 'Upload failed - network error' : undefined
});

// 10 Comprehensive Edge Case Test Reports
const PREMADE_REPORTS: any[] = [
    // ============ REPORT 1: SKELETON - Absolute Minimum ============
    {
        _testName: "SKELETON - Empty/Null Everything",
        summary: "",
        machine: { serialNumber: "", modelNumber: "", machineType: "", controllerType: "", softwareVersion: "" },
        customer: { companyName: "", contactPerson: "", position: "", address: "", phone: "" },
        serviceTypes: [],
        issues: [],
        parts: [],
        toolsBought: [],
        toolsUsed: [],
        newNameplates: [],
        attachments: [],
        followUpRequired: false,
        designSuggestion: { current: "", problem: "", change: "" },
        internalSuggestion: ""
    },

    // ============ REPORT 2: MINIMAL - Just Enough ============
    {
        _testName: "MINIMAL - Bare Minimum Data",
        summary: "Quick check.",
        machine: { serialNumber: "SN-001", modelNumber: "", machineType: "", controllerType: "", softwareVersion: "" },
        customer: { companyName: "Acme Corp", contactPerson: "", position: "", address: "", phone: "" },
        serviceTypes: ["Billable Repair"],
        issues: [
            { title: "Minor issue", category: "Not Specified", urgency: "Low", resolved: false, description: "", proposedFixes: [], troubleshootingSteps: [], rootCause: "", fixApplied: "", verifiedBy: "", notes: "", solutionSummary: "", addToMfgReport: false, followUpRequired: false }
        ],
        parts: [],
        toolsBought: [],
        toolsUsed: [],
        newNameplates: [],
        attachments: [],
        followUpRequired: false,
        designSuggestion: { current: "", problem: "", change: "" },
        internalSuggestion: ""
    },

    // ============ REPORT 3: TOGGLE FLIP - Same as Minimal but All Toggles ON ============
    {
        _testName: "TOGGLE FLIP - All Booleans True",
        summary: "Quick check with all flags enabled.",
        machine: { serialNumber: "SN-001", modelNumber: "", machineType: "", controllerType: "", softwareVersion: "" },
        customer: { companyName: "Acme Corp", contactPerson: "", position: "", address: "", phone: "" },
        serviceTypes: ["Billable Repair"],
        issues: [
            { title: "Minor issue - NOW RESOLVED", category: "Not Specified", urgency: "Low", resolved: true, description: "Same issue but now resolved.", proposedFixes: [], troubleshootingSteps: [], rootCause: "Found the root cause", fixApplied: "Applied the fix", verifiedBy: "QC Team", notes: "All good now", solutionSummary: "Issue resolved successfully", addToMfgReport: true, followUpRequired: true }
        ],
        parts: [],
        toolsBought: [],
        toolsUsed: [],
        newNameplates: [],
        attachments: [],
        followUpRequired: true,
        designSuggestion: { current: "", problem: "", change: "" },
        internalSuggestion: ""
    },

    // ============ REPORT 4: PHOTO ONLY - Minimal Data, Maximum Photos ============
    {
        _testName: "PHOTO ONLY - Max Attachments, Min Text",
        summary: "Photos everywhere.",
        machine: { serialNumber: "PHOTO-001", modelNumber: "", machineType: "", controllerType: "", softwareVersion: "" },
        customer: { companyName: "PhotoTest Inc", contactPerson: "", position: "", address: "", phone: "" },
        serviceTypes: [],
        issues: [
            {
                title: "Issue with many photos",
                category: "Mechanical",
                urgency: "Medium",
                resolved: true,
                description: "See attached photos.",
                proposedFixes: [],
                troubleshootingSteps: [],
                rootCause: "Visual inspection",
                fixApplied: "See photos",
                verifiedBy: "Photo evidence",
                notes: "",
                solutionSummary: "Documented with photos",
                addToMfgReport: false,
                followUpRequired: false,
                attachments: [
                    makePhoto('issue1-desc-1', 'issue_photos', 'description'),
                    makePhoto('issue1-desc-2', 'issue_photos', 'description'),
                    makePhoto('issue1-root-1', 'issue_photos', 'rootCause'),
                    makePhoto('issue1-fix-1', 'issue_photos', 'fixApplied', 'uploading'),
                    makePhoto('issue1-fix-2', 'issue_photos', 'fixApplied', 'error')
                ]
            }
        ],
        parts: [],
        toolsBought: [],
        toolsUsed: [],
        newNameplates: [],
        attachments: [
            makePhoto('summary-1', 'summary'),
            makePhoto('summary-2', 'summary'),
            makePhoto('created-1', 'created_media'),
            makePhoto('received-1', 'received_media'),
            makePhoto('wechat-1', 'wechat'),
            makePhoto('wechat-2', 'wechat'),
            makePhoto('backup-old-1', 'old_backup'),
            makePhoto('backup-new-1', 'new_backup'),
            makePhoto('nameplate-1', 'machineNameplate'),
            makePhoto('nameplate-2', 'machineNameplate', undefined, 'uploading')
        ],
        followUpRequired: false,
        designSuggestion: { current: "", problem: "", change: "" },
        internalSuggestion: ""
    },

    // ============ REPORT 5: TEXT EXTREME - Maximum Text Length ============
    {
        _testName: "TEXT EXTREME - Very Long Text & Special Chars",
        summary: `EXTREMELY LONG SUMMARY - This is a comprehensive stress test for text handling capabilities.

Paragraph 1: Arrived on site at 0730 hours. Met with production supervisor John Smith who explained the situation in great detail. The machine had been running a complex aerospace part (P/N: ASM-7742-REV-C) when operators noticed unusual vibration patterns emerging from the spindle assembly. Initial readings showed amplitude spikes of ±0.003" at 12,000 RPM - well outside acceptable tolerances.

Paragraph 2: Upon inspection, found multiple contributing factors including: worn spindle bearings (NSK 7014CTYNDBLP4), degraded way covers allowing chip ingress, coolant concentration at 4.2% (should be 6-8%), and outdated compensation tables dating back to 2019.

Paragraph 3: Special characters test: Quotes "double" and 'single', ampersand &, less than <, greater than >, backslash \\, forward slash /, brackets [square] {curly} (round), pipes |, tildes ~, backticks \`, at signs @, hashes #, dollars $, percents %, carets ^, asterisks *, plus +, equals =, underscores _.

Paragraph 4: Unicode test: Chinese 中文测试, Japanese テスト, Korean 테스트, Arabic اختبار, Russian тест, Greek δοκιμή, Emoji 🔧⚙️🛠️✅❌⚠️.

Paragraph 5: Technical symbols: ±0.001", Ø25mm, 45°, µm, ², ³, ½, ¼, ¾, °C, °F, Ω, ∑, √, ∞, ≈, ≠, ≤, ≥, →, ←, ↑, ↓.

Paragraph 6: Code snippet test: \`G90 G54 G00 X0 Y0; M03 S12000; G43 H01 Z50.; G01 Z-5. F500;\`

This summary intentionally contains over 2000 characters to test text wrapping, scrolling, and overflow handling in the UI components.`,
        machine: {
            serialNumber: "EXTREME-TEXT-SERIAL-NUMBER-WITH-MANY-CHARACTERS-123456789",
            modelNumber: "Model Number That Is Unnecessarily Long For Testing Purposes XL-9000-EXTENDED-VERSION",
            machineType: "5-Axis Simultaneous Mill-Turn Multi-Tasking Center with Integrated Robot Loading",
            controllerType: "Siemens SINUMERIK 840D sl with ShopMill/ShopTurn and Manage MyMachines",
            softwareVersion: "V4.8 SP6 HF12 Build 2024.03.15.001-BETA-EXTENDED-RELEASE-CANDIDATE"
        },
        customer: {
            companyName: "Extremely Long Company Name That Tests UI Text Wrapping Incorporated International LLC",
            contactPerson: "Dr. Professor Sir Reginald Bartholomew Featherstonehaugh III, PhD, MBA, PE",
            position: "Senior Vice President of Manufacturing Engineering and Continuous Improvement",
            address: "12345 Very Long Street Name Boulevard, Building A, Suite 100, Floor 15, Industrial Park West, Springfield, Some Really Long State Name, 12345-6789, United States of America",
            phone: "+1 (555) 123-4567 ext. 89012345"
        },
        serviceTypes: ["Installation / Commissioning", "Preventive Maintenance", "Warranty Repair", "Billable Repair", "Training", "Retrofit", "Remote Support"],
        issues: [
            {
                title: "Issue With An Extremely Long Title That Tests How The UI Handles Text Overflow And Wrapping In Card Headers And List Items",
                category: "Mechanical",
                urgency: "Critical",
                resolved: true,
                description: "This is an extremely long description that spans multiple paragraphs and includes various edge cases for text handling.\n\nSecond paragraph with more technical details about the issue. The spindle bearing (NSK 7014CTYNDBLP4) showed signs of wear with increased radial play measured at 0.0004\" TIR.\n\nThird paragraph with resolution steps that were considered and evaluated before selecting the optimal approach.\n\nFourth paragraph: Special chars test - \"quotes\", 'apostrophes', <brackets>, &ampersand, code: `G90 G54 X0 Y0`.",
                proposedFixes: [
                    "First proposed fix with a very long description that explains the rationale and expected outcome in great detail",
                    "Second proposed fix option that provides an alternative approach with different trade-offs",
                    "Third option considered but ultimately rejected due to cost considerations"
                ],
                troubleshootingSteps: [
                    "Step 1: Initial diagnostic procedure including visual inspection, measurement, and data collection",
                    "Step 2: Advanced diagnostics using specialized equipment (laser interferometer, ballbar, vibration analyzer)",
                    "Step 3: Root cause analysis and failure mode identification",
                    "Step 4: Solution implementation and verification testing"
                ],
                rootCause: "After extensive investigation including vibration analysis, thermal imaging, and microscopic inspection of the bearing surfaces, the root cause was determined to be a combination of inadequate lubrication interval and contamination ingress through degraded seals.",
                fixApplied: "Complete spindle rebuild including new bearings (NSK 7014CTYNDBLP4 matched set), new seals (all 6 positions), fresh grease pack (Kluber Isoflex NBU 15), and updated maintenance schedule documentation.",
                verifiedBy: "Quality Control Department - Certified CMM Inspection - Report #QC-2024-0342",
                notes: "This notes field also contains a lot of text to test how the UI handles very long notes content. Additional recommendations include monthly vibration trending, quarterly grease replenishment, and annual full PM service.\n\nCustomer was advised of extended warranty options available for the rebuilt spindle assembly.",
                solutionSummary: "Spindle assembly completely rebuilt with new bearings and seals. Vibration levels now within specification at all speeds. Customer PM schedule updated to prevent recurrence.",
                addToMfgReport: true,
                followUpRequired: true
            }
        ],
        parts: [
            { id: "p1", partNumber: "EXTREMELY-LONG-PART-NUMBER-123456789-REV-A", description: "Part with a very long description that explains what this part is and why it was needed for the repair", quantity: "999", notes: "Very long notes about this part including sourcing information and lead time details", type: "used" }
        ],
        toolsBought: [
            { id: "tb1", text: "Specialized tool with extremely long name - Model XL-9000 Series Professional Grade Industrial Version" },
            { id: "tb2", text: "Another tool purchase with detailed description including specifications and vendor information" }
        ],
        toolsUsed: [
            { id: "tu1", text: "Tool 1: Precision measurement equipment with calibration certificate #CAL-2024-0001" },
            { id: "tu2", text: "Tool 2: Specialized bearing installation kit with temperature-controlled heating elements" }
        ],
        newNameplates: [
            { id: "np1", text: "Replacement nameplate for spindle assembly - S/N: SPINDLE-2024-NEW-001 - Date: 2024-01-15" }
        ],
        attachments: [],
        followUpRequired: true,
        designSuggestion: {
            current: "Current implementation has a very long description that explains the existing design or process in great detail, including historical context and rationale for original decisions.",
            problem: "Problem statement is also very detailed, explaining all the issues observed, their frequency, impact on production, and customer frustration level.",
            change: "Suggested change includes comprehensive implementation plan with timeline, resource requirements, expected benefits, ROI analysis, and risk mitigation strategies."
        },
        internalSuggestion: "Internal notes field with extensive commentary about customer relationship, commercial considerations, potential upsell opportunities, and strategic account management notes. This should only be visible internally and never shared with the customer."
    },

    // ============ REPORT 6: ARRAY STRESS - Many Items Everywhere ============
    {
        _testName: "ARRAY STRESS - Maximum Array Items",
        summary: "Stress test with many items in all arrays.",
        machine: { serialNumber: "ARRAY-001", modelNumber: "Stress Test 3000", machineType: "Multi-Array", controllerType: "ListController", softwareVersion: "v999" },
        customer: { companyName: "ArrayMax Industries", contactPerson: "Array Manager", position: "List Lead", address: "123 Array St", phone: "555-0000" },
        serviceTypes: ["Installation / Commissioning", "Preventive Maintenance", "Warranty Repair", "Billable Repair", "Training", "Retrofit", "Remote Support"],
        issues: Array.from({length: 10}, (_, i) => ({
            title: `Issue #${i + 1} - ${i % 2 === 0 ? 'Resolved' : 'Open'}`,
            category: ["Mechanical", "Electrical", "Software/Control", "Hydraulic", "Pneumatic"][i % 5],
            urgency: ["Low", "Medium", "High", "Critical"][i % 4],
            resolved: i % 2 === 0,
            description: `Description for issue ${i + 1}. This is a test issue.`,
            proposedFixes: Array.from({length: 5}, (_, j) => `Proposed fix ${j + 1} for issue ${i + 1}`),
            troubleshootingSteps: Array.from({length: 5}, (_, j) => `Troubleshooting step ${j + 1} for issue ${i + 1}`),
            rootCause: i % 2 === 0 ? `Root cause for issue ${i + 1}` : "",
            fixApplied: i % 2 === 0 ? `Fix applied for issue ${i + 1}` : "",
            verifiedBy: i % 2 === 0 ? "QC Team" : "",
            notes: `Notes for issue ${i + 1}`,
            solutionSummary: i % 2 === 0 ? `Solution summary for issue ${i + 1}` : "",
            addToMfgReport: i % 3 === 0,
            followUpRequired: i % 4 === 0,
            parts: Array.from({length: 2}, (_, j) => ({
                id: `issue${i}-part${j}`,
                partNumber: `PART-${i}-${j}`,
                description: `Part ${j + 1} for issue ${i + 1}`,
                quantity: String(j + 1),
                notes: "",
                type: ["used", "needed", "waiting"][j % 3] as any
            }))
        })),
        parts: Array.from({length: 20}, (_, i) => ({
            id: `report-part-${i}`,
            partNumber: `RP-${String(i).padStart(4, '0')}`,
            description: `Report-level part ${i + 1}`,
            quantity: String(Math.floor(Math.random() * 10) + 1),
            notes: i % 3 === 0 ? `Note for part ${i + 1}` : "",
            type: ["used", "needed", "waiting"][i % 3] as any
        })),
        toolsBought: Array.from({length: 15}, (_, i) => ({ id: `tb-${i}`, text: `Tool bought #${i + 1}` })),
        toolsUsed: Array.from({length: 15}, (_, i) => ({ id: `tu-${i}`, text: `Tool used #${i + 1}` })),
        newNameplates: Array.from({length: 10}, (_, i) => ({ id: `np-${i}`, text: `Nameplate #${i + 1} - S/N: NP-${i}` })),
        attachments: Array.from({length: 8}, (_, i) => makePhoto(`array-photo-${i}`, ['summary', 'issue_photos', 'created_media', 'received_media'][i % 4])),
        followUpRequired: true,
        designSuggestion: { current: "Current state", problem: "Problem identified", change: "Suggested change" },
        internalSuggestion: "Internal notes for array stress test"
    },

    // ============ REPORT 7: MIXED RESOLUTION - Half & Half ============
    {
        _testName: "MIXED RESOLUTION - 3 Resolved, 3 Unresolved",
        summary: "Testing mixed resolution states with varying urgency levels.",
        machine: { serialNumber: "MIXED-001", modelNumber: "HalfHalf", machineType: "Test Machine", controllerType: "MixController", softwareVersion: "v1.0" },
        customer: { companyName: "Mixed Results Co", contactPerson: "Half Manager", position: "Resolution Lead", address: "50/50 Street", phone: "555-5050" },
        serviceTypes: ["Billable Repair", "Preventive Maintenance"],
        issues: [
            { title: "Resolved Issue - Low Priority", category: "Mechanical", urgency: "Low", resolved: true, description: "This was a minor issue that has been resolved.", proposedFixes: ["Fix A"], troubleshootingSteps: ["Step 1"], rootCause: "Simple cause", fixApplied: "Simple fix", verifiedBy: "Tech", notes: "", solutionSummary: "All good", addToMfgReport: false, followUpRequired: false },
            { title: "UNRESOLVED - Critical Priority", category: "Electrical", urgency: "Critical", resolved: false, description: "This is a critical issue still open.", proposedFixes: ["Proposed A", "Proposed B"], troubleshootingSteps: ["Tried X", "Tried Y"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Waiting on parts", solutionSummary: "", addToMfgReport: true, followUpRequired: true },
            { title: "Resolved Issue - High Priority", category: "Software/Control", urgency: "High", resolved: true, description: "High priority issue that was resolved.", proposedFixes: ["Fix 1", "Fix 2"], troubleshootingSteps: ["Debug", "Test"], rootCause: "Software bug", fixApplied: "Patch applied", verifiedBy: "QA Team", notes: "Monitor for recurrence", solutionSummary: "Software patch resolved the issue", addToMfgReport: true, followUpRequired: false },
            { title: "UNRESOLVED - High Priority", category: "Hydraulic", urgency: "High", resolved: false, description: "Hydraulic issue needs attention.", proposedFixes: ["Replace seals"], troubleshootingSteps: ["Pressure test"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Scheduled for next visit", solutionSummary: "", addToMfgReport: false, followUpRequired: true },
            { title: "Resolved Issue - Medium Priority", category: "Pneumatic", urgency: "Medium", resolved: true, description: "Medium priority resolved.", proposedFixes: ["Adjust pressure"], troubleshootingSteps: ["Check valves"], rootCause: "Valve stuck", fixApplied: "Replaced valve", verifiedBy: "Operator", notes: "", solutionSummary: "New valve installed", addToMfgReport: false, followUpRequired: false },
            { title: "UNRESOLVED - Low Priority", category: "Operator Error", urgency: "Low", resolved: false, description: "Training needed.", proposedFixes: ["Schedule training"], troubleshootingSteps: ["Observed operations"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Training session planned", solutionSummary: "", addToMfgReport: false, followUpRequired: false }
        ],
        parts: [],
        toolsBought: [],
        toolsUsed: [],
        newNameplates: [],
        attachments: [],
        followUpRequired: true,
        designSuggestion: { current: "", problem: "", change: "" },
        internalSuggestion: ""
    },

    // ============ REPORT 8: FULL COMPLETE - Everything Filled Properly ============
    {
        _testName: "FULL COMPLETE - Happy Path",
        summary: "Complete service visit with all fields properly filled. Arrived on site at 8:00 AM, met with customer, performed comprehensive PM service and addressed two issues. Machine now running at optimal performance. Customer satisfied with service quality.",
        machine: {
            serialNumber: "COMPLETE-2024-001",
            modelNumber: "DMU 80 eVo",
            machineType: "5-Axis VMC",
            controllerType: "Heidenhain TNC 640",
            softwareVersion: "16.0.6 SP1"
        },
        customer: {
            companyName: "Premium Manufacturing Corp",
            contactPerson: "Mike Johnson",
            position: "Maintenance Manager",
            address: "456 Industrial Parkway, Unit 12, Springfield, IL 62701",
            phone: "(555) 234-5678"
        },
        serviceTypes: ["Preventive Maintenance", "Billable Repair"],
        issues: [
            {
                title: "Spindle Vibration at High Speed",
                category: "Mechanical",
                urgency: "High",
                resolved: true,
                description: "Customer reported increased vibration when running above 15,000 RPM. Vibration analyzer showed 0.15 IPS at spindle nose.",
                proposedFixes: ["Balance spindle", "Check drawbar"],
                troubleshootingSteps: ["Vibration measurement", "Runout check", "Drawbar force test"],
                rootCause: "Spindle bearings showing early wear signs",
                fixApplied: "Adjusted bearing preload and rebalanced spindle assembly",
                verifiedBy: "Customer maintenance tech witnessed test cuts",
                notes: "Recommend full bearing replacement at next major PM",
                solutionSummary: "Spindle rebalanced and preload adjusted. Vibration now at 0.03 IPS - within spec.",
                addToMfgReport: true,
                followUpRequired: true,
                parts: [{ id: "i1p1", partNumber: "BRG-SHIM-002", description: "Bearing preload shim", quantity: "2", notes: "", type: "used" }]
            },
            {
                title: "Coolant Concentration Low",
                category: "Process/Application",
                urgency: "Low",
                resolved: true,
                description: "Refractometer reading showed 3.2% concentration, should be 6-8%.",
                proposedFixes: ["Add concentrate"],
                troubleshootingSteps: ["Refractometer test"],
                rootCause: "Normal evaporation and drag-out",
                fixApplied: "Added 5 gallons of concentrate, adjusted to 7%",
                verifiedBy: "Operator",
                notes: "",
                solutionSummary: "Coolant concentration restored to specification.",
                addToMfgReport: false,
                followUpRequired: false
            }
        ],
        parts: [
            { id: "rp1", partNumber: "FILTER-HYD-001", description: "Hydraulic filter element", quantity: "1", notes: "Replaced during PM", type: "used" },
            { id: "rp2", partNumber: "FILTER-AIR-002", description: "Air filter element", quantity: "1", notes: "", type: "used" }
        ],
        toolsBought: [
            { id: "tb1", text: "Refractometer (replacement for broken unit)" }
        ],
        toolsUsed: [
            { id: "tu1", text: "Vibration analyzer - Fluke 810" },
            { id: "tu2", text: "Dial indicator set" },
            { id: "tu3", text: "Drawbar force gauge" }
        ],
        newNameplates: [],
        attachments: [
            makePhoto('complete-1', 'summary'),
            makePhoto('complete-2', 'issue_photos')
        ],
        followUpRequired: true,
        designSuggestion: {
            current: "Current PM interval is 6 months",
            problem: "Machine runs 24/7, showing wear faster than expected",
            change: "Recommend 4-month PM interval for this usage pattern"
        },
        internalSuggestion: "Good customer relationship. Consider proposing service contract at next visit."
    },

    // ============ REPORT 9: CATEGORY COVERAGE - One Issue Per Category ============
    {
        _testName: "CATEGORY COVERAGE - All 8 Categories",
        summary: "Test report with one issue for each category type.",
        machine: { serialNumber: "CAT-001", modelNumber: "Category Test", machineType: "All-Category", controllerType: "CatControl", softwareVersion: "v8.0" },
        customer: { companyName: "Category Testing Inc", contactPerson: "Cat Manager", position: "Category Lead", address: "8 Category Lane", phone: "555-8888" },
        serviceTypes: ["Billable Repair"],
        issues: [
            { title: "Not Specified Category Issue", category: "Not Specified", urgency: "Low", resolved: true, description: "General issue.", proposedFixes: [], troubleshootingSteps: [], rootCause: "Unknown", fixApplied: "Fixed", verifiedBy: "Tech", notes: "", solutionSummary: "Done", addToMfgReport: false, followUpRequired: false },
            { title: "Mechanical Category Issue", category: "Mechanical", urgency: "Medium", resolved: false, description: "Mechanical problem.", proposedFixes: ["Adjust"], troubleshootingSteps: ["Inspect"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "", solutionSummary: "", addToMfgReport: false, followUpRequired: false },
            { title: "Electrical Category Issue", category: "Electrical", urgency: "High", resolved: true, description: "Electrical fault.", proposedFixes: ["Rewire"], troubleshootingSteps: ["Multimeter test"], rootCause: "Bad connection", fixApplied: "Reconnected", verifiedBy: "Electrician", notes: "", solutionSummary: "Connection repaired", addToMfgReport: true, followUpRequired: false },
            { title: "Software/Control Category Issue", category: "Software/Control", urgency: "Critical", resolved: false, description: "Software crash.", proposedFixes: ["Update firmware"], troubleshootingSteps: ["Log analysis"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Waiting for update", solutionSummary: "", addToMfgReport: true, followUpRequired: true },
            { title: "Hydraulic Category Issue", category: "Hydraulic", urgency: "Low", resolved: true, description: "Minor leak.", proposedFixes: ["Replace seal"], troubleshootingSteps: ["Pressure test"], rootCause: "Worn seal", fixApplied: "New seal installed", verifiedBy: "Operator", notes: "", solutionSummary: "Leak fixed", addToMfgReport: false, followUpRequired: false },
            { title: "Pneumatic Category Issue", category: "Pneumatic", urgency: "Medium", resolved: false, description: "Air pressure low.", proposedFixes: ["Check compressor"], troubleshootingSteps: ["Pressure gauge"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "", solutionSummary: "", addToMfgReport: false, followUpRequired: false },
            { title: "Operator Error Category Issue", category: "Operator Error", urgency: "High", resolved: true, description: "Wrong parameters entered.", proposedFixes: ["Training"], troubleshootingSteps: ["Review logs"], rootCause: "Lack of training", fixApplied: "Provided training", verifiedBy: "Supervisor", notes: "", solutionSummary: "Operator trained", addToMfgReport: false, followUpRequired: false },
            { title: "Process/Application Category Issue", category: "Process/Application", urgency: "Critical", resolved: true, description: "Wrong cutting parameters.", proposedFixes: ["Optimize feeds"], troubleshootingSteps: ["Tool wear analysis"], rootCause: "Feeds too aggressive", fixApplied: "Reduced feed rate 20%", verifiedBy: "Programmer", notes: "", solutionSummary: "Parameters optimized", addToMfgReport: true, followUpRequired: false }
        ],
        parts: [],
        toolsBought: [],
        toolsUsed: [],
        newNameplates: [],
        attachments: [],
        followUpRequired: true,
        designSuggestion: { current: "", problem: "", change: "" },
        internalSuggestion: ""
    },

    // ============ REPORT 10: UNICODE & EDGE CHARS ============
    {
        _testName: "UNICODE & EDGE CHARS - International Text",
        summary: "Unicode test: 中文摘要 | 日本語テスト | 한국어 테스트 | العربية | Ελληνικά | Кириллица\n\nEmojis: 🔧 ⚙️ 🛠️ ✅ ❌ ⚠️ 📷 📎 💾 🖥️\n\nMath: ±0.001\" | Ø25mm | 45° | 100µm | x² | √16 | ∞ | π≈3.14159 | Σ | Δ | Ω\n\nSpecial: <script>alert('xss')</script> | \"quotes\" | 'apostrophes' | &amp; | backslash \\ | pipe |",
        machine: {
            serialNumber: "日本語シリアル-001",
            modelNumber: "中文型号 XL-9000",
            machineType: "多軸加工センター",
            controllerType: "控制器 v2.0",
            softwareVersion: "버전 3.5.1 한글"
        },
        customer: {
            companyName: "国际公司 International 株式会社",
            contactPerson: "Müller François 田中太郎",
            position: "Geschäftsführer / 社長",
            address: "日本国東京都渋谷区1-2-3 ビル5F",
            phone: "+81 (03) 1234-5678"
        },
        serviceTypes: ["Training"],
        issues: [
            {
                title: "Issue with <special> \"chars\" & 'symbols'",
                category: "Software/Control",
                urgency: "Medium",
                resolved: true,
                description: "Description with HTML entities: &lt;div&gt; &amp; &quot;test&quot;\n\nCode block:\n```\nG90 G54 G00 X0 Y0\nM03 S12000\n```\n\nUnicode: 中文描述 | Ø25 ±0.01 | 45° | µm",
                proposedFixes: ["Fix with émojis 🔧", "Option B: 日本語対応"],
                troubleshootingSteps: ["Step 1: Überprüfung", "Step 2: 検査完了"],
                rootCause: "Причина: encoding issue | 原因：编码问题",
                fixApplied: "修正済み: UTF-8 encoding applied | Lösung implementiert",
                verifiedBy: "山田花子 (Yamada Hanako)",
                notes: "Notes with\nmultiple\nline breaks\n\nAnd special chars: <>&\"'`~!@#$%^*()[]{}|\\",
                solutionSummary: "Solution: 解决方案完成 ✅",
                addToMfgReport: true,
                followUpRequired: false
            }
        ],
        parts: [
            { id: "p1", partNumber: "部品-001-日本語", description: "Description with émojis 🔩 and unicode: Größe 25mm", quantity: "5", notes: "备注：中文备注", type: "used" }
        ],
        toolsBought: [
            { id: "tb1", text: "工具 with special <chars> & \"quotes\"" }
        ],
        toolsUsed: [
            { id: "tu1", text: "测量工具 Ø0.001\" | 精度 ±0.0001\"" }
        ],
        newNameplates: [
            { id: "np1", text: "銘板 S/N: 日本語-001 | Größe: 50×25mm" }
        ],
        attachments: [
            { ...makePhoto('unicode-1', 'summary'), fileName: "照片 photo with spaces & 特殊字符.jpg" },
            { ...makePhoto('unicode-2', 'issue_photos'), fileName: "Bild_Ümläuts_Größe.png" }
        ],
        followUpRequired: false,
        designSuggestion: {
            current: "現状: Current implementation with 日本語",
            problem: "問題点: Encoding issues with special chars <>&",
            change: "改善案: Full UTF-8 support with emoji 🎉"
        },
        internalSuggestion: "内部メモ: Internal notes in Japanese\n\n中文内部备注: Chinese internal notes\n\nSpecial chars: <script>test</script> | SQL: SELECT * FROM users WHERE id='1' OR '1'='1'"
    }
];

export const generateEdgeCaseReportContent = async (): Promise<any> => {
    // Randomly select one of the pre-made reports
    const randomIndex = Math.floor(Math.random() * PREMADE_REPORTS.length);
    const selected = JSON.parse(JSON.stringify(PREMADE_REPORTS[randomIndex])); // Deep clone

    // Process issues to add IDs and format arrays properly
    if (selected.issues && selected.issues.length > 0) {
        selected.issues = selected.issues.map((issue: any, idx: number) => ({
            id: `test-issue-${Date.now()}-${idx}`,
            ...issue,
            proposedFixes: (issue.proposedFixes || []).map((fix: any, i: number) =>
                typeof fix === 'string' ? { id: `fix-${idx}-${i}`, text: fix } : fix
            ),
            troubleshootingSteps: (issue.troubleshootingSteps || []).map((step: any, i: number) =>
                typeof step === 'string' ? { id: `step-${idx}-${i}`, text: step } : step
            ),
            attachments: issue.attachments || [],
            parts: issue.parts || []
        }));
    }

    // Add console log to show which test case was selected
    console.log(`[EdgeCase] Selected test: ${selected._testName || 'Unknown'}`);

    return selected;
};