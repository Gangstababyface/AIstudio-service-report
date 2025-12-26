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

// Pre-made edge case reports for testing
const PREMADE_REPORTS = [
    {
        summary: "Emergency callout at 3:47 AM. Customer reported complete machine shutdown during production run. Upon arrival found coolant flooding the electrical cabinet. Spent 4 hours draining, cleaning, and drying components. Multiple boards damaged. Spindle drive showed error E-4502. Had to bypass safety interlocks temporarily to diagnose. Production manager extremely frustrated - they have a major order due Friday.",
        machine: { serialNumber: "DMG-2024-X7821", modelNumber: "DMU 65 monoBLOCK", machineType: "5-Axis Mill", controllerType: "Siemens 840D sl", softwareVersion: "4.8 SP6 HF2" },
        issues: [
            { title: "Coolant Leak into Electrical Cabinet", category: "Mechanical", urgency: "Critical", resolved: true, description: "Coolant pump seal failed catastrophically, spraying coolant directly into the main electrical cabinet through a gap in the cable routing. Found 2L of coolant pooled at bottom of cabinet.", proposedFixes: ["Replace pump seal", "Add drip tray"], troubleshootingSteps: ["Isolated power", "Drained cabinet", "Tested each board"], rootCause: "Worn pump seal + missing cabinet gasket", fixApplied: "Replaced seal, added silicone gasket, installed drip shield", verifiedBy: "Customer QC Manager", notes: "Recommend monthly seal inspection", solutionSummary: "Replaced failed coolant pump seal and sealed cabinet entry points" },
            { title: "Spindle Drive Board Failure", category: "Electrical", urgency: "Critical", resolved: false, description: "Main spindle drive board (6SN1123-1AA00-0EA2) showing burn marks on power stage. Error E-4502 persistent. Board needs replacement - not repairable on site.", proposedFixes: ["Replace drive board", "Check for secondary damage"], troubleshootingSteps: ["Visual inspection", "Resistance tests", "Contacted Siemens"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Part on order - 3 day lead time. Customer running backup machine.", solutionSummary: "" },
            { title: "Z-Axis Position Drift", category: "Mechanical", urgency: "High", resolved: true, description: "Z-axis showing 0.015mm drift over 2 hour cycle. Thermal compensation not working correctly.", proposedFixes: ["Recalibrate thermal comp", "Check scale"], troubleshootingSteps: ["Laser measurement", "Thermal imaging"], rootCause: "Thermal comp table corrupted", fixApplied: "Reloaded factory thermal compensation values", verifiedBy: "Operator shift lead", notes: "", solutionSummary: "Restored thermal compensation parameters" }
        ]
    },
    {
        summary: "Scheduled PM visit turned into major repair. Customer complained of 'weird noises' from B-axis. Found severe wear on torque motor bearing. Additionally discovered hydraulic system contamination - milky fluid indicating water ingress. Tool changer also intermittent. This machine has been neglected - last PM was 18 months ago despite recommendations.",
        machine: { serialNumber: "MORI-NTX-44291", modelNumber: "NTX 2000", machineType: "Mill-Turn", controllerType: "MAPPS IV", softwareVersion: "2.1.445" },
        issues: [
            { title: "B-Axis Torque Motor Bearing Wear", category: "Mechanical", urgency: "Critical", resolved: false, description: "Significant play detected in B-axis. Bearing surfaces show scoring. Vibration analysis confirms bearing defect at 127Hz. Machine should not run heavy cuts until replaced.", proposedFixes: ["Replace bearing assembly", "Check motor alignment"], troubleshootingSteps: ["Vibration analysis", "Dial indicator test", "Acoustic measurement"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Bearing kit ordered. Arrival in 5 days. Quoted customer for labor.", solutionSummary: "" },
            { title: "Hydraulic Fluid Contamination", category: "Hydraulic", urgency: "High", resolved: true, description: "Hydraulic fluid appears milky white - water contamination confirmed. Tested sample shows 2.3% water content. Source traced to condensation in reservoir.", proposedFixes: ["Flush system", "Replace fluid", "Add breather"], troubleshootingSteps: ["Fluid sample", "Reservoir inspection"], rootCause: "Missing desiccant breather allowed moisture ingress", fixApplied: "Complete flush, new fluid, installed breather", verifiedBy: "Tech supervisor", notes: "Recommend fluid analysis every 6 months", solutionSummary: "Flushed contaminated hydraulic system and installed desiccant breather" },
            { title: "Tool Changer Intermittent Fault", category: "Electrical", urgency: "Medium", resolved: true, description: "Random T-code errors. Tool change sometimes stalls mid-cycle. Alarm 2041 appears sporadically.", proposedFixes: ["Check proximity sensors", "Inspect wiring"], troubleshootingSteps: ["Sensor output test", "Wiring continuity", "PLC diagnostics"], rootCause: "Corroded connector on pot position sensor", fixApplied: "Cleaned and sealed connector, applied dielectric grease", verifiedBy: "Operator", notes: "", solutionSummary: "Repaired corroded sensor connector" }
        ]
    },
    {
        summary: "Customer upgrade installation - retrofitting new probing system and updating control software. Integration more complex than quoted. Renishaw probe communication protocol incompatible with existing post processor. Spent extra day rewriting macros. Customer satisfied with final result but frustrated with timeline.",
        machine: { serialNumber: "HAAS-VF4-29182", modelNumber: "VF-4SS", machineType: "VMC", controllerType: "Haas NGC", softwareVersion: "100.20.000.1130" },
        issues: [
            { title: "Probe Communication Protocol Mismatch", category: "Software/Control", urgency: "High", resolved: true, description: "New Renishaw OMP60 probe uses different serial protocol than legacy system. Existing macros failed to trigger probe correctly. Required complete rewrite of probing routines.", proposedFixes: ["Update macros", "Check baud rate settings"], troubleshootingSteps: ["Protocol analyzer", "Macro debugging", "Renishaw tech support call"], rootCause: "Probe expects different handshake sequence", fixApplied: "Rewrote O9999 probing macro suite for new protocol", verifiedBy: "Customer programmer", notes: "Documented new macro parameters for customer", solutionSummary: "Developed new probing macros compatible with OMP60 protocol" },
            { title: "Spindle Orientation Timeout", category: "Software/Control", urgency: "Medium", resolved: true, description: "After software update, M19 spindle orient taking 8+ seconds and occasionally timing out. Was instant before.", proposedFixes: ["Adjust orient parameters", "Check encoder"], troubleshootingSteps: ["Parameter review", "Encoder signal check"], rootCause: "Update reset orient window parameter to default", fixApplied: "Restored parameter 208 to 15 degrees", verifiedBy: "Setup tech", notes: "", solutionSummary: "Corrected spindle orientation parameter" },
            { title: "Tool Length Offset Discrepancy", category: "Mechanical", urgency: "Low", resolved: true, description: "Tool setter reading 0.002\" different than probe. Calibration drift suspected.", proposedFixes: ["Recalibrate setter", "Check probe stylus"], troubleshootingSteps: ["Reference gauge test", "Repeatability study"], rootCause: "Tool setter arm slightly bent", fixApplied: "Replaced tool setter arm, recalibrated both systems", verifiedBy: "QC inspector", notes: "Both systems now agree within 0.0002\"", solutionSummary: "Replaced damaged tool setter arm and recalibrated" }
        ]
    },
    {
        summary: "Power surge damage assessment. Lightning strike nearby caused voltage spike. Machine was running unattended overnight. Found multiple fried components. CNC control boots but crashes randomly. Servo amps show fault codes. Estimating $45K+ in damage. Customer's insurance adjuster on site tomorrow - need detailed report.",
        machine: { serialNumber: "MAZAK-I600-77123", modelNumber: "INTEGREX i-600", machineType: "Multi-Tasking", controllerType: "MAZATROL SmoothX", softwareVersion: "J1.2.0" },
        issues: [
            { title: "CNC Control Random Crashes", category: "Electrical", urgency: "Critical", resolved: false, description: "Main CNC control unit boots successfully but crashes to blue screen within 5-30 minutes. Sometimes during idle, sometimes during operation. Memory diagnostics show errors.", proposedFixes: ["Replace control unit", "Check power conditioning"], troubleshootingSteps: ["Memory test", "Voltage monitoring", "Heat stress test"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Control unit likely damaged internally. Replacement quoted at $28,000.", solutionSummary: "" },
            { title: "X-Axis Servo Amplifier Fault", category: "Electrical", urgency: "Critical", resolved: false, description: "Servo amp showing error 16 (IPM fault). Amp runs hot even with motor disconnected. Internal IGBT modules likely damaged from surge.", proposedFixes: ["Replace servo amp"], troubleshootingSteps: ["Thermal imaging", "IGBT gate test"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Amp replacement $8,500. Lead time 2 weeks.", solutionSummary: "" },
            { title: "Surge Protector Failure", category: "Electrical", urgency: "High", resolved: true, description: "Main line surge protector found completely destroyed. Did its job absorbing the spike but sacrificed itself.", proposedFixes: ["Replace with higher rated unit"], troubleshootingSteps: ["Visual inspection"], rootCause: "Lightning-induced surge exceeded protector rating", fixApplied: "Installed new 100kA rated surge protector", verifiedBy: "Electrician", notes: "Recommend adding UPS for control", solutionSummary: "Replaced destroyed surge protector with higher capacity unit" },
            { title: "Spindle Encoder Erratic", category: "Electrical", urgency: "Medium", resolved: false, description: "Spindle encoder giving intermittent position errors. May have been damaged by surge traveling through motor cables.", proposedFixes: ["Replace encoder"], troubleshootingSteps: ["Signal integrity test"], rootCause: "", fixApplied: "", verifiedBy: "", notes: "Adding to insurance claim", solutionSummary: "" }
        ]
    },
    {
        summary: "Precision calibration and accuracy restoration. Customer failing parts inspection - CMM showing 0.003\" deviation on critical bore. Full geometric calibration performed with laser interferometer. Found multiple axis errors. Ballbar test showed significant reversal spikes. After full calibration, machine back to spec. Customer very happy.",
        machine: { serialNumber: "OKUMA-MB56-88456", modelNumber: "MB-56VA", machineType: "VMC", controllerType: "OSP-P300MA", softwareVersion: "P300MA-R02" },
        issues: [
            { title: "X-Axis Pitch Error Compensation", category: "Mechanical", urgency: "High", resolved: true, description: "Laser measurement showed X-axis pitch error of +0.0004\"/inch cumulative. Total error at 20\" travel was 0.008\". Well outside spec.", proposedFixes: ["Update pitch error comp table", "Check ballscrew"], troubleshootingSteps: ["Laser interferometry full axis map", "Temperature stabilization"], rootCause: "Compensation table had drifted from thermal cycles", fixApplied: "Remapped entire X-axis comp table with 87 data points", verifiedBy: "Customer QC with test cuts", notes: "Now within 0.0001\"/inch", solutionSummary: "Complete X-axis pitch error compensation recalibration" },
            { title: "Y-Axis Reversal Backlash", category: "Mechanical", urgency: "High", resolved: true, description: "Ballbar test showed 12 micron reversal spike on Y-axis. Visible as witness marks on circular interpolation test cuts.", proposedFixes: ["Adjust backlash comp", "Check gibs"], troubleshootingSteps: ["Ballbar test", "Gib clearance measurement"], rootCause: "Backlash compensation value incorrect", fixApplied: "Adjusted parameter from 0.003mm to 0.012mm", verifiedBy: "Ballbar retest", notes: "Reversal now under 3 microns", solutionSummary: "Corrected Y-axis backlash compensation parameter" },
            { title: "Squareness XY Plane", category: "Mechanical", urgency: "Medium", resolved: true, description: "Squareness between X and Y measured at 0.0006\"/12\". Customer spec requires 0.0003\"/12\".", proposedFixes: ["Adjust squareness compensation"], troubleshootingSteps: ["Laser squareness measurement", "Diagonal test cuts"], rootCause: "Natural drift over time", fixApplied: "Updated squareness comp in control", verifiedBy: "Diagonal test part", notes: "Now at 0.00015\"/12\"", solutionSummary: "Applied electronic squareness compensation" },
            { title: "Spindle Runout", category: "Mechanical", urgency: "Low", resolved: true, description: "Measured 0.0003\" TIR at spindle nose. Within spec but customer wanted it checked.", proposedFixes: ["Clean taper", "Check bearing preload"], troubleshootingSteps: ["Dial indicator test", "Taper inspection"], rootCause: "Minor contamination in taper", fixApplied: "Cleaned and polished spindle taper", verifiedBy: "Indicator retest", notes: "Now at 0.00008\" TIR", solutionSummary: "Cleaned spindle taper to reduce runout" }
        ]
    }
];

export const generateEdgeCaseReportContent = async (): Promise<any> => {
    // Randomly select one of the pre-made reports
    const randomIndex = Math.floor(Math.random() * PREMADE_REPORTS.length);
    const selected = PREMADE_REPORTS[randomIndex];

    // Add IDs to issues
    const issuesWithIds = selected.issues.map((issue, idx) => ({
        id: `test-issue-${Date.now()}-${idx}`,
        ...issue,
        proposedFixes: issue.proposedFixes.map((fix, i) => ({ id: `fix-${idx}-${i}`, text: fix })),
        troubleshootingSteps: issue.troubleshootingSteps.map((step, i) => ({ id: `step-${idx}-${i}`, text: step })),
        attachments: [],
        parts: []
    }));

    return {
        ...selected,
        issues: issuesWithIds
    };
};