import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const deepseekClient = new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || ""
});

const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

export interface ParsedJob {
    job_title: string;
    department: string;
    location: string;
    salary_min: number | null;
    salary_max: number | null;
    salary_period: 'yearly' | 'hourly' | 'monthly';
    closing_date: string | null;
    work_model: 'Hybrid' | 'Remote' | 'On-site';
    employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Permanent';
    duration: string;
    is_unionized: boolean;
    union_name: string;
    is_student: boolean;
    is_inventory: boolean;
    benefits: string[];
    clean_description: string;
}

export async function parseJobWithAI(description: string): Promise<ParsedJob | null> {
    const prompt = `
    Extract the following information from the job description text provided. 
    Return the data in a valid JSON format. Be extremely precise.

    SCHEMA:
    {
      "job_title": "Cleaned title (remove IDs/Internal labels)",
      "department": "Department name",
      "location": "City",
      "salary_min": number | null,
      "salary_max": number | null,
      "salary_period": "yearly" | "hourly" | "monthly",
      "closing_date": "YYYY-MM-DD" | null,
      "work_model": "Hybrid" | "Remote" | "On-site",
      "employment_type": "Full-time" | "Part-time" | "Contract" | "Permanent",
      "duration": "Length of contract if applicable",
      "is_unionized": boolean,
      "union_name": "Union name or Non-Union",
      "is_student": boolean,
      "is_inventory": boolean,
      "benefits": ["pension", "health", "dental", etc],
      "clean_description": "Markdown formatted, NO boilerplate"
    }

    CONSTRAINTS:
    - If salary is a range like "$96,566.00 - $132,880.00", salary_min = 96566, salary_max = 132880.
    - If salary is hourly, keep it hourly (do not multiply).
    - Closing date: infer the date if it says "Closing in 2 weeks" relative to June 13, 2026.

    Text:
    ${description}
    `;

    try {
        const completion = await deepseekClient.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: AI_MODEL,
            response_format: { type: "json_object" },
            timeout: 60000
        });

        const content = completion.choices[0].message.content;
        if (!content) {
            console.error("AI returned empty content");
            return null;
        }

        return JSON.parse(content) as ParsedJob;
    } catch (error: any) {
        console.error(`AI parsing error (${AI_MODEL}):`, error.message);
        return null;
    }
}
