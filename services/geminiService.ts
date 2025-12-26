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

// MEGA Edge Case Report - One report with EVERYTHING
const MEGA_EDGE_CASE_REPORT = {
    _testName: "MEGA EDGE CASE - Everything Combined",
    summary: `COMPREHENSIVE EDGE CASE STRESS TEST 🔧⚙️🛠️

Paragraph 1 - LONG TEXT: Arrived on site at 0730 hours. Met with production supervisor John Smith who explained the situation in great detail. The machine had been running a complex aerospace part (P/N: ASM-7742-REV-C) when operators noticed unusual vibration patterns emerging from the spindle assembly. Initial readings showed amplitude spikes of ±0.003" at 12,000 RPM - well outside acceptable tolerances. This requires immediate attention.

Paragraph 2 - TECHNICAL: Upon inspection, found multiple contributing factors including: worn spindle bearings (NSK 7014CTYNDBLP4), degraded way covers allowing chip ingress, coolant concentration at 4.2% (should be 6-8%), and outdated compensation tables dating back to 2019.

Paragraph 3 - SPECIAL CHARS: Quotes "double" and 'single', ampersand &, less than <, greater than >, backslash \\, forward slash /, brackets [square] {curly} (round), pipes |, tildes ~, backticks \`, at signs @, hashes #, dollars $, percents %, carets ^, asterisks *, plus +, equals =, underscores _.

Paragraph 4 - UNICODE: Chinese 中文测试, Japanese テスト, Korean 테스트, Arabic اختبار, Russian тест, Greek δοκιμή.

Paragraph 5 - SYMBOLS: ±0.001", Ø25mm, 45°, µm, ², ³, ½, ¼, ¾, °C, °F, Ω, ∑, √, ∞, ≈, ≠, ≤, ≥, →, ←, ↑, ↓.

Paragraph 6 - CODE: \`G90 G54 G00 X0 Y0; M03 S12000; G43 H01 Z50.; G01 Z-5. F500;\`

This summary contains 2000+ characters to test text wrapping and overflow handling. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`,
    machine: {
        serialNumber: "MEGA-EDGE-SERIAL-中文-日本語-123456789-EXTREME",
        modelNumber: "Model XL-9000 多軸加工センター EXTENDED-VERSION",
        machineType: "5-Axis Simultaneous Mill-Turn Multi-Tasking Center with Integrated Robot Loading",
        controllerType: "Siemens SINUMERIK 840D sl with ShopMill/ShopTurn | 控制器 v2.0",
        softwareVersion: "V4.8 SP6 HF12 Build 2024.03.15.001-BETA 버전 3.5.1"
    },
    customer: {
        companyName: "Extremely Long Company Name 国际公司 株式会社 International LLC",
        contactPerson: "Dr. Professor Sir Reginald Müller François 田中太郎 III, PhD",
        position: "Senior Vice President of Manufacturing Engineering / Geschäftsführer / 社長",
        address: "12345 Very Long Street 日本国東京都渋谷区1-2-3, Building A, Suite 100, Floor 15, Industrial Park, 12345-6789",
        phone: "+1 (555) 123-4567 ext. 89012345 | +81 (03) 1234-5678"
    },
    serviceTypes: ["Installation / Commissioning", "Preventive Maintenance", "Warranty Repair", "Billable Repair", "Training", "Retrofit", "Remote Support"],
    issues: [
        // Issue 1: EMPTY/MINIMAL - No data at all
        {
            title: "Issue 1: EMPTY - Minimal data test",
            category: "Not Specified",
            urgency: "Low",
            resolved: false,
            description: "",
            proposedFixes: [],
            troubleshootingSteps: [],
            rootCause: "",
            fixApplied: "",
            verifiedBy: "",
            notes: "",
            solutionSummary: "",
            addToMfgReport: false,
            followUpRequired: false,
            parts: [],
            attachments: []
        },
        // Issue 2: RESOLVED with all toggles ON
        {
            title: "Issue 2: ALL TOGGLES ON - Resolved with everything enabled",
            category: "Mechanical",
            urgency: "Critical",
            resolved: true,
            description: "This issue has all boolean flags enabled for testing conditional rendering.",
            proposedFixes: ["Fix A", "Fix B"],
            troubleshootingSteps: ["Step 1", "Step 2"],
            rootCause: "Root cause identified",
            fixApplied: "Comprehensive fix applied",
            verifiedBy: "QC Team Lead",
            notes: "All flags enabled",
            solutionSummary: "Complete resolution achieved",
            addToMfgReport: true,
            followUpRequired: true,
            parts: [
                { id: "i2p1", partNumber: "PART-TOGGLE-001", description: "Toggle test part", quantity: "5", notes: "Part note", type: "used" }
            ],
            attachments: [
                makePhoto('issue2-photo1', 'issue_photos', 'description'),
                makePhoto('issue2-photo2', 'issue_photos', 'fixApplied')
            ]
        },
        // Issue 3: UNRESOLVED Critical - waiting on parts
        {
            title: "Issue 3: UNRESOLVED CRITICAL - Still open, high priority",
            category: "Electrical",
            urgency: "Critical",
            resolved: false,
            description: "Critical electrical issue that remains unresolved. Waiting on replacement parts from supplier.",
            proposedFixes: ["Replace motor drive", "Rewire control panel", "Update PLC program"],
            troubleshootingSteps: ["Multimeter test", "Oscilloscope analysis", "PLC diagnostics"],
            rootCause: "",
            fixApplied: "",
            verifiedBy: "",
            notes: "Waiting on parts. ETA 2 weeks. Customer notified.",
            solutionSummary: "",
            addToMfgReport: true,
            followUpRequired: true,
            parts: [
                { id: "i3p1", partNumber: "MOTOR-DRV-500", description: "Replacement motor drive", quantity: "1", notes: "On order", type: "waiting" },
                { id: "i3p2", partNumber: "CABLE-SET-100", description: "Power cable set", quantity: "3", notes: "", type: "needed" }
            ],
            attachments: [
                makePhoto('issue3-photo1', 'issue_photos', 'description', 'uploading'),
                makePhoto('issue3-photo2', 'issue_photos', 'description', 'error')
            ]
        },
        // Issue 4: EXTREME TEXT - Very long content
        {
            title: "Issue 4: EXTREME TEXT - An Issue Title That Is Extremely Long To Test How The UI Handles Text Overflow And Wrapping In Card Headers And List Items And Just Keeps Going",
            category: "Software/Control",
            urgency: "High",
            resolved: true,
            description: "This is an extremely long description that spans multiple paragraphs and includes various edge cases for text handling.\n\nSecond paragraph with more technical details about the issue. The spindle bearing (NSK 7014CTYNDBLP4) showed signs of wear with increased radial play measured at 0.0004\" TIR.\n\nThird paragraph with resolution steps that were considered and evaluated before selecting the optimal approach.\n\nFourth paragraph: Special chars test - \"quotes\", 'apostrophes', <brackets>, &ampersand, code: `G90 G54 X0 Y0`.\n\nFifth paragraph with even more content to really stress test the text display area. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
            proposedFixes: [
                "First proposed fix with a very long description that explains the rationale and expected outcome in great detail including technical specifications",
                "Second proposed fix option that provides an alternative approach with different trade-offs and considerations",
                "Third option considered but ultimately rejected due to cost considerations and implementation complexity",
                "Fourth option for testing long lists",
                "Fifth option to make this list even longer"
            ],
            troubleshootingSteps: [
                "Step 1: Initial diagnostic procedure including visual inspection, measurement, and data collection over multiple days",
                "Step 2: Advanced diagnostics using specialized equipment (laser interferometer, ballbar, vibration analyzer)",
                "Step 3: Root cause analysis and failure mode identification with cross-functional team review",
                "Step 4: Solution implementation and verification testing with customer sign-off",
                "Step 5: Documentation and knowledge base update"
            ],
            rootCause: "After extensive investigation including vibration analysis, thermal imaging, and microscopic inspection of the bearing surfaces, the root cause was determined to be a combination of inadequate lubrication interval and contamination ingress through degraded seals. This is intentionally long to test text wrapping.",
            fixApplied: "Complete spindle rebuild including new bearings (NSK 7014CTYNDBLP4 matched set), new seals (all 6 positions), fresh grease pack (Kluber Isoflex NBU 15), and updated maintenance schedule documentation. Additional work included recalibration of all axes.",
            verifiedBy: "Quality Control Department - Certified CMM Inspection - Report #QC-2024-0342 - Customer Witness",
            notes: "This notes field also contains extensive text to test how the UI handles very long notes content. Additional recommendations include monthly vibration trending, quarterly grease replenishment, and annual full PM service.\n\nSecond paragraph of notes with more detail.",
            solutionSummary: "Spindle assembly completely rebuilt with new bearings and seals. Vibration levels now within specification at all speeds. Customer PM schedule updated to prevent recurrence. Full documentation provided.",
            addToMfgReport: true,
            followUpRequired: true,
            parts: [
                { id: "i4p1", partNumber: "EXTREMELY-LONG-PART-NUMBER-123456789-REV-A", description: "Part with very long description explaining purpose", quantity: "999", notes: "Very long notes", type: "used" }
            ],
            attachments: []
        },
        // Issue 5: HYDRAULIC - Medium, Resolved
        {
            title: "Issue 5: Hydraulic System Leak",
            category: "Hydraulic",
            urgency: "Medium",
            resolved: true,
            description: "Minor hydraulic leak detected at cylinder seal.",
            proposedFixes: ["Replace seal kit"],
            troubleshootingSteps: ["Pressure test", "Visual inspection"],
            rootCause: "Worn seal from age",
            fixApplied: "Installed new seal kit",
            verifiedBy: "Operator confirmed no leak",
            notes: "",
            solutionSummary: "Seal replaced, leak fixed",
            addToMfgReport: false,
            followUpRequired: false,
            parts: [
                { id: "i5p1", partNumber: "SEAL-KIT-HYD-100", description: "Hydraulic seal kit", quantity: "1", notes: "", type: "used" }
            ],
            attachments: [
                makePhoto('issue5-photo1', 'issue_photos', 'description'),
                makePhoto('issue5-photo2', 'issue_photos', 'fixApplied')
            ]
        },
        // Issue 6: PNEUMATIC - Low, Unresolved
        {
            title: "Issue 6: Pneumatic Pressure Fluctuation",
            category: "Pneumatic",
            urgency: "Low",
            resolved: false,
            description: "Air pressure drops intermittently. Not affecting production currently.",
            proposedFixes: ["Check compressor", "Replace regulator"],
            troubleshootingSteps: ["Pressure monitoring"],
            rootCause: "",
            fixApplied: "",
            verifiedBy: "",
            notes: "Monitor for now, address at next PM",
            solutionSummary: "",
            addToMfgReport: false,
            followUpRequired: false,
            parts: [],
            attachments: []
        },
        // Issue 7: OPERATOR ERROR - High, Resolved
        {
            title: "Issue 7: Operator Incorrectly Set Parameters",
            category: "Operator Error",
            urgency: "High",
            resolved: true,
            description: "Operator entered wrong feed rate causing tool breakage.",
            proposedFixes: ["Training session", "Add parameter locks"],
            troubleshootingSteps: ["Review alarm logs", "Interview operator"],
            rootCause: "Insufficient training on new control software",
            fixApplied: "Provided 2-hour training session",
            verifiedBy: "Supervisor witnessed demo cuts",
            notes: "Schedule follow-up training in 30 days",
            solutionSummary: "Operator trained on correct procedures",
            addToMfgReport: false,
            followUpRequired: true,
            parts: [],
            attachments: []
        },
        // Issue 8: PROCESS/APPLICATION - Critical, Resolved
        {
            title: "Issue 8: Process Optimization Required",
            category: "Process/Application",
            urgency: "Critical",
            resolved: true,
            description: "Cutting parameters causing excessive tool wear and poor surface finish.",
            proposedFixes: ["Optimize feeds and speeds", "Change tool geometry"],
            troubleshootingSteps: ["Tool wear analysis", "Surface roughness measurement", "Vibration analysis"],
            rootCause: "Cutting speed 40% too high for material",
            fixApplied: "Reduced RPM from 15000 to 10000, adjusted feed accordingly",
            verifiedBy: "Quality lab measured Ra 0.8µm - within spec",
            notes: "Updated program library with optimized parameters",
            solutionSummary: "Process optimized, tool life improved 3x, surface finish meets spec",
            addToMfgReport: true,
            followUpRequired: false,
            parts: [
                { id: "i8p1", partNumber: "TOOL-INSERT-NEW", description: "New insert geometry", quantity: "10", notes: "", type: "used" }
            ],
            attachments: [
                makePhoto('issue8-photo1', 'issue_photos', 'rootCause'),
                makePhoto('issue8-photo2', 'issue_photos', 'fixApplied'),
                makePhoto('issue8-photo3', 'issue_photos', 'solutionSummary')
            ]
        },
        // Issue 9: UNICODE/SPECIAL CHARS
        {
            title: "Issue 9: Unicode 中文問題 <special> \"chars\" & 'symbols'",
            category: "Software/Control",
            urgency: "Medium",
            resolved: true,
            description: "Description with HTML entities: &lt;div&gt; &amp; &quot;test&quot;\n\nCode block:\n```\nG90 G54 G00 X0 Y0\nM03 S12000\n```\n\nUnicode: 中文描述 | 日本語テスト | Ø25 ±0.01 | 45° | µm\n\nSpecial: <script>alert('xss')</script> | \"quotes\" | 'apostrophes' | &amp;",
            proposedFixes: ["Fix with émojis 🔧", "Option B: 日本語対応", "Option C: Größe ändern"],
            troubleshootingSteps: ["Step 1: Überprüfung", "Step 2: 検査完了", "Step 3: 한국어 테스트"],
            rootCause: "Причина: encoding issue | 原因：编码问题",
            fixApplied: "修正済み: UTF-8 encoding applied | Lösung implementiert",
            verifiedBy: "山田花子 (Yamada Hanako) | Müller François",
            notes: "Notes with\nmultiple\nline breaks\n\nAnd special chars: <>&\"'`~!@#$%^*()[]{}|\\",
            solutionSummary: "Solution: 解决方案完成 ✅ | Lösung abgeschlossen",
            addToMfgReport: true,
            followUpRequired: false,
            parts: [
                { id: "i9p1", partNumber: "部品-001-日本語", description: "Description with émojis 🔩 and unicode: Größe 25mm", quantity: "5", notes: "备注：中文备注", type: "used" }
            ],
            attachments: [
                { ...makePhoto('issue9-photo1', 'issue_photos', 'description'), fileName: "照片 photo with spaces & 特殊字符.jpg" }
            ]
        },
        // Issue 10: MANY PHOTOS
        {
            title: "Issue 10: Photo Documentation Heavy",
            category: "Mechanical",
            urgency: "Low",
            resolved: true,
            description: "Issue with extensive photo documentation across all fields.",
            proposedFixes: ["Document with photos"],
            troubleshootingSteps: ["Visual inspection"],
            rootCause: "Documented visually",
            fixApplied: "See attached photos",
            verifiedBy: "Photo evidence",
            notes: "All stages documented",
            solutionSummary: "Fully documented with photos",
            addToMfgReport: false,
            followUpRequired: false,
            parts: [],
            attachments: [
                makePhoto('issue10-desc-1', 'issue_photos', 'description'),
                makePhoto('issue10-desc-2', 'issue_photos', 'description'),
                makePhoto('issue10-desc-3', 'issue_photos', 'description'),
                makePhoto('issue10-root-1', 'issue_photos', 'rootCause'),
                makePhoto('issue10-root-2', 'issue_photos', 'rootCause'),
                makePhoto('issue10-fix-1', 'issue_photos', 'fixApplied'),
                makePhoto('issue10-fix-2', 'issue_photos', 'fixApplied'),
                makePhoto('issue10-fix-3', 'issue_photos', 'fixApplied', 'uploading'),
                makePhoto('issue10-fix-4', 'issue_photos', 'fixApplied', 'error')
            ]
        },
        // Issues 11-15: More variety for stress test
        ...Array.from({length: 5}, (_, i) => ({
            title: `Issue ${11 + i}: Stress Test Issue #${i + 1} - ${i % 2 === 0 ? 'Resolved' : 'Open'}`,
            category: ["Mechanical", "Electrical", "Software/Control", "Hydraulic", "Pneumatic"][i % 5],
            urgency: ["Low", "Medium", "High", "Critical"][i % 4],
            resolved: i % 2 === 0,
            description: `Description for stress test issue ${i + 1}. Testing list rendering with many issues.`,
            proposedFixes: Array.from({length: 3}, (_, j) => `Proposed fix ${j + 1} for issue ${11 + i}`),
            troubleshootingSteps: Array.from({length: 3}, (_, j) => `Step ${j + 1} for issue ${11 + i}`),
            rootCause: i % 2 === 0 ? `Root cause for stress issue ${i + 1}` : "",
            fixApplied: i % 2 === 0 ? `Fix applied for stress issue ${i + 1}` : "",
            verifiedBy: i % 2 === 0 ? "QC Team" : "",
            notes: `Notes for stress issue ${i + 1}`,
            solutionSummary: i % 2 === 0 ? `Solution summary for stress issue ${i + 1}` : "",
            addToMfgReport: i % 3 === 0,
            followUpRequired: i % 2 !== 0,
            parts: i % 2 === 0 ? [
                { id: `i${11+i}p1`, partNumber: `STRESS-PART-${i}`, description: `Part for stress issue ${i + 1}`, quantity: String(i + 1), notes: "", type: ["used", "needed", "waiting"][i % 3] as any }
            ] : [],
            attachments: i % 3 === 0 ? [makePhoto(`stress-${i}-photo`, 'issue_photos')] : []
        }))
    ],
    parts: [
        { id: "rp1", partNumber: "FILTER-HYD-001", description: "Hydraulic filter element", quantity: "1", notes: "Replaced during PM", type: "used" },
        { id: "rp2", partNumber: "FILTER-AIR-002", description: "Air filter element", quantity: "2", notes: "", type: "used" },
        { id: "rp3", partNumber: "BEARING-SPINDLE-NSK", description: "NSK 7014CTYNDBLP4 matched set", quantity: "1", notes: "Critical spare", type: "used" },
        { id: "rp4", partNumber: "SEAL-KIT-COMPLETE", description: "Complete seal kit for spindle rebuild", quantity: "1", notes: "", type: "used" },
        { id: "rp5", partNumber: "LUBE-KLUBER-NBU15", description: "Kluber Isoflex NBU 15 grease", quantity: "2", notes: "kg", type: "used" },
        { id: "rp6", partNumber: "MOTOR-DRV-500-SPARE", description: "Spare motor drive for next visit", quantity: "1", notes: "On order - 2 week lead", type: "waiting" },
        { id: "rp7", partNumber: "CABLE-SIGNAL-SET", description: "Signal cable replacement set", quantity: "1", notes: "Recommend for next PM", type: "needed" },
        { id: "rp8", partNumber: "PART-日本語-001", description: "Unicode part: 部品 Größe ±0.01", quantity: "5", notes: "备注", type: "used" },
        ...Array.from({length: 12}, (_, i) => ({
            id: `rp${9 + i}`,
            partNumber: `STRESS-RP-${String(i).padStart(3, '0')}`,
            description: `Stress test report-level part ${i + 1}`,
            quantity: String(Math.floor(Math.random() * 10) + 1),
            notes: i % 3 === 0 ? `Note for part ${i + 1}` : "",
            type: ["used", "needed", "waiting"][i % 3] as any
        }))
    ],
    toolsBought: [
        { id: "tb1", text: "Refractometer (replacement for broken unit)" },
        { id: "tb2", text: "Specialized precision measurement tool - Model XL-9000 Professional Grade" },
        { id: "tb3", text: "工具 with special <chars> & \"quotes\" - 日本語" },
        ...Array.from({length: 12}, (_, i) => ({ id: `tb${4 + i}`, text: `Tool bought #${i + 4} - stress test` }))
    ],
    toolsUsed: [
        { id: "tu1", text: "Vibration analyzer - Fluke 810" },
        { id: "tu2", text: "Dial indicator set - Mitutoyo" },
        { id: "tu3", text: "Drawbar force gauge" },
        { id: "tu4", text: "Laser interferometer - Renishaw XL-80" },
        { id: "tu5", text: "测量工具 Ø0.001\" | 精度 ±0.0001\"" },
        ...Array.from({length: 10}, (_, i) => ({ id: `tu${6 + i}`, text: `Tool used #${i + 6} - stress test` }))
    ],
    newNameplates: [
        { id: "np1", text: "Spindle nameplate - S/N: SPINDLE-2024-NEW-001" },
        { id: "np2", text: "Motor nameplate - S/N: MOTOR-2024-REP-001" },
        { id: "np3", text: "銘板 S/N: 日本語-001 | Größe: 50×25mm" },
        ...Array.from({length: 7}, (_, i) => ({ id: `np${4 + i}`, text: `Nameplate #${i + 4} - S/N: NP-STRESS-${i}` }))
    ],
    attachments: [
        makePhoto('summary-1', 'summary'),
        makePhoto('summary-2', 'summary'),
        makePhoto('summary-3', 'summary'),
        makePhoto('created-1', 'created_media'),
        makePhoto('created-2', 'created_media'),
        makePhoto('received-1', 'received_media'),
        makePhoto('received-2', 'received_media'),
        makePhoto('wechat-1', 'wechat'),
        makePhoto('wechat-2', 'wechat'),
        makePhoto('wechat-3', 'wechat'),
        makePhoto('backup-old-1', 'old_backup'),
        makePhoto('backup-old-2', 'old_backup'),
        makePhoto('backup-new-1', 'new_backup'),
        makePhoto('backup-new-2', 'new_backup'),
        makePhoto('nameplate-1', 'machineNameplate'),
        makePhoto('nameplate-2', 'machineNameplate'),
        makePhoto('nameplate-3', 'machineNameplate', undefined, 'uploading'),
        makePhoto('nameplate-4', 'machineNameplate', undefined, 'error'),
        { ...makePhoto('unicode-file-1', 'summary'), fileName: "照片 photo with spaces & 特殊字符.jpg" },
        { ...makePhoto('unicode-file-2', 'created_media'), fileName: "Bild_Ümläuts_Größe.png" }
    ],
    followUpRequired: true,
    designSuggestion: {
        current: "Current implementation has detailed description including historical context and rationale. 現状: Current implementation with 日本語. This tests long text in design suggestion fields.",
        problem: "Problem statement is detailed: Encoding issues with special chars <>&. 問題点: Multiple issues observed affecting production. Customer frustration level high.",
        change: "Suggested change: Full UTF-8 support with emoji 🎉. Comprehensive implementation plan with timeline, resource requirements, expected benefits. 改善案: Complete overhaul recommended."
    },
    internalSuggestion: "Internal notes field with extensive commentary. 内部メモ: Internal notes in Japanese. 中文内部备注: Chinese internal notes.\n\nGood customer relationship. Consider proposing service contract.\n\nSpecial chars test: <script>test</script> | SQL: SELECT * FROM users WHERE id='1' OR '1'='1'\n\nCommercial considerations and strategic account management notes. Potential upsell: Extended warranty, PM contract, training package."
};

export const generateEdgeCaseReportContent = async (): Promise<any> => {
    // Return the mega edge case report (deep clone to prevent mutation)
    const report = JSON.parse(JSON.stringify(MEGA_EDGE_CASE_REPORT));

    // Process issues to add IDs and format arrays properly
    if (report.issues && report.issues.length > 0) {
        report.issues = report.issues.map((issue: any, idx: number) => ({
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

    console.log(`[EdgeCase] Generated MEGA report with ${report.issues.length} issues, ${report.parts.length} parts, ${report.attachments.length} attachments`);

    return report;
};