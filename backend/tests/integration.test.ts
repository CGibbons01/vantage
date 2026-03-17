import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile } from "./helpers";

// Set Adzuna credentials for tests if not already set
process.env.ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || "98619faa";
process.env.ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || "2899cb384058f7a2a293c3ff47b84359";

describe("API Integration Tests", () => {
  let authToken: string;
  let applicationId: string;
  let jobId: string = "";

  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
  });

  // Profile endpoints
  test("Get user profile", async () => {
    const res = await authenticatedApi("/api/profile", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.userId).toBeDefined();
  });

  test("Update user profile", async () => {
    const res = await authenticatedApi("/api/profile", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: "Senior Developer",
        summary: "Experienced software engineer",
        location: "London, UK",
        phone: "+44 123 456 7890",
        skills: ["TypeScript", "React", "Node.js"],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.headline).toBe("Senior Developer");
  });

  test("Upload CV", async () => {
    const form = new FormData();
    form.append("cv", createTestFile("resume.pdf", "Sample CV content", "application/pdf"));
    const res = await authenticatedApi("/api/profile/upload-cv", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  // Job endpoints
  test("Search jobs", async () => {
    const res = await authenticatedApi("/api/jobs/search?keywords=developer&location=uk", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.jobs).toBeDefined();
    // Extract first job ID if available for use in subsequent tests
    if (data.jobs && data.jobs.length > 0) {
      jobId = data.jobs[0].id;
    }
  });

  test("Get job detail", async () => {
    // Only test if we have a real job ID from search results
    if (jobId) {
      const res = await authenticatedApi(`/api/jobs/${jobId}`, authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
    }
  });

  test("Get job detail - not found", async () => {
    const res = await authenticatedApi("/api/jobs/nonexistent-job-id", authToken);
    await expectStatus(res, 404);
  });

  // Applications CRUD
  test("List applications", async () => {
    const res = await authenticatedApi("/api/applications", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.applications).toBeDefined();
  });

  test("Create application", async () => {
    const res = await authenticatedApi("/api/applications", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: "job-123",
        job_title: "Senior Developer",
        company: "Tech Corp",
        location: "London",
        job_url: "https://example.com/jobs/123",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    applicationId = data.id;
    expect(applicationId).toBeDefined();
  });

  test("Create application - missing required field", async () => {
    const res = await authenticatedApi("/api/applications", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: "job-456",
        job_title: "Developer",
        // missing required fields: company, location, job_url
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update application", async () => {
    const res = await authenticatedApi(`/api/applications/${applicationId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "applied",
        notes: "Sent application on March 14",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.status).toBe("applied");
  });

  test("Delete application", async () => {
    const res = await authenticatedApi(`/api/applications/${applicationId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Update application - not found", async () => {
    const res = await authenticatedApi("/api/applications/00000000-0000-0000-0000-000000000000", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
    await expectStatus(res, 404);
  });

  test("Delete application - not found", async () => {
    const res = await authenticatedApi("/api/applications/00000000-0000-0000-0000-000000000000", authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 404);
  });

  test("Update application - invalid UUID format", async () => {
    const res = await authenticatedApi("/api/applications/invalid-uuid", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
    await expectStatus(res, 400);
  });

  test("Delete application - invalid UUID format", async () => {
    const res = await authenticatedApi("/api/applications/invalid-uuid", authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  // CV Generation AI endpoint
  test("Generate CV", async () => {
    const res = await authenticatedApi("/api/cv/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        email: "john@example.com",
        target_role: "Senior Software Engineer",
        summary: "Experienced full-stack developer with 5 years of experience",
        skills: ["JavaScript", "TypeScript", "React", "Node.js"],
        experience: [
          {
            company: "Tech Corp",
            role: "Software Developer",
            duration: "2020-2023",
            description: "Developed and maintained web applications using React and Node.js",
          },
        ],
        education: [
          {
            institution: "State University",
            degree: "BS Computer Science",
            year: "2020",
          },
        ],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.cv_text).toBeDefined();
    expect(data.sections).toBeDefined();
  });

  test("Generate CV - missing required field", async () => {
    const res = await authenticatedApi("/api/cv/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        email: "john@example.com",
        // missing required: target_role, summary, skills, experience, education
      }),
    });
    await expectStatus(res, 400);
  });

  // CV Improvement AI endpoint
  test("Improve CV", async () => {
    const res = await authenticatedApi("/api/cv/improve", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "John Doe\nSoftware Developer\nTech Corp (2020-2023)\nSkills: JavaScript, TypeScript, React",
        target_role: "Senior Software Engineer",
        focus_areas: ["keywords", "impact_statements"],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.improved_cv_text).toBeDefined();
    expect(data.suggestions).toBeDefined();
  });

  test("Improve CV - missing required field", async () => {
    const res = await authenticatedApi("/api/cv/improve", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "Sample CV text",
        // missing required: target_role
      }),
    });
    await expectStatus(res, 400);
  });

  // CV Scoring AI endpoint
  test("Score CV", async () => {
    const form = new FormData();
    form.append("cv", createTestFile("resume.pdf", "John Doe\nSoftware Engineer at Tech Corp\nSkills: JavaScript, TypeScript, React, Node.js\nExperience: 5 years", "application/pdf"));
    const res = await authenticatedApi("/api/cv/score", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.score).toBeDefined();
    expect(data.industry_fit).toBeDefined();
  });

  test("Score CV - missing required field", async () => {
    const form = new FormData();
    // Upload empty form without "cv" field
    const res = await authenticatedApi("/api/cv/score", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 400);
  });

  // CV Export PDF endpoint
  test("Export CV as PDF", async () => {
    const res = await authenticatedApi("/api/cv/export-pdf", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "John Doe\nSoftware Engineer\nSkills: JavaScript, TypeScript, React, Node.js",
        title: "John_Doe_CV",
      }),
    });
    await expectStatus(res, 200);
    const text = await res.text();
    expect(text).toBeTruthy();
  });

  test("Export CV as PDF - missing content", async () => {
    const res = await authenticatedApi("/api/cv/export-pdf", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "John_Doe_CV",
      }),
    });
    await expectStatus(res, 400);
  });

  // CV Parse endpoint
  test("Parse CV file", async () => {
    const form = new FormData();
    form.append("cv", createTestFile("resume.pdf", "John Doe\nSoftware Engineer at Tech Corp\nSkills: JavaScript, TypeScript, React, Node.js", "application/pdf"));
    const res = await authenticatedApi("/api/cv/parse", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.raw_text).toBeDefined();
    expect(data.parsed).toBeDefined();
  });

  test("Parse CV file - missing file", async () => {
    const form = new FormData();
    const res = await authenticatedApi("/api/cv/parse", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 400);
  });

  // Cover Letter Generation AI endpoint
  test("Generate cover letter", async () => {
    const res = await authenticatedApi("/api/cover-letter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant_name: "John Doe",
        job_title: "Senior Software Engineer",
        company_name: "Tech Corp",
        job_description: "We are seeking a senior engineer with 5+ years of experience in full-stack development",
        cv_summary: "Experienced full-stack developer with 5 years in software development",
        tone: "professional",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.cover_letter).toBeDefined();
    expect(data.word_count).toBeDefined();
  });

  test("Generate cover letter - missing required field", async () => {
    const res = await authenticatedApi("/api/cover-letter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant_name: "John Doe",
        job_title: "Senior Developer",
        // missing required: company_name, job_description, cv_summary
      }),
    });
    await expectStatus(res, 400);
  });

  // Cover Letter Export PDF endpoint
  test("Export cover letter as PDF", async () => {
    const res = await authenticatedApi("/api/cover-letter/export-pdf", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Dear Hiring Manager,\nI am interested in the Senior Developer position...",
        title: "John_Doe_Cover_Letter",
      }),
    });
    await expectStatus(res, 200);
    const text = await res.text();
    expect(text).toBeTruthy();
  });

  test("Export cover letter as PDF - missing content", async () => {
    const res = await authenticatedApi("/api/cover-letter/export-pdf", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "John_Doe_Cover_Letter",
      }),
    });
    await expectStatus(res, 400);
  });

  // Job Matching AI endpoint
  test("Match jobs to CV", async () => {
    const res = await authenticatedApi("/api/jobs/match", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "John Doe\nSoftware Engineer at Tech Corp\nSkills: JavaScript, TypeScript, React, Node.js",
        jobs: [
          {
            id: "job1",
            title: "Frontend Developer",
            description: "Looking for React developer with 3+ years experience",
            company: "Tech Corp",
            required_skills: ["React", "JavaScript"],
          },
          {
            id: "job2",
            title: "Backend Developer",
            description: "Looking for Node.js developer with 5+ years experience",
            company: "Another Corp",
            required_skills: ["Node.js", "TypeScript"],
          },
        ],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.matches).toBeDefined();
  });

  test("Match jobs to CV - missing required field", async () => {
    const res = await authenticatedApi("/api/jobs/match", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "John Doe",
        // missing required: jobs
      }),
    });
    await expectStatus(res, 400);
  });

  // Longevity Analyze endpoint
  test("Analyze career longevity", async () => {
    const res = await authenticatedApi("/api/longevity/analyze", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "John Doe\nSoftware Engineer at Tech Corp (2020-2023)\nExperience: 5 years in software development",
        job_title: "Senior Software Engineer",
        industry: "Technology",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test("Analyze career longevity - missing cv_text", async () => {
    const res = await authenticatedApi("/api/longevity/analyze", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_title: "Senior Software Engineer",
      }),
    });
    await expectStatus(res, 400);
  });

  // Unauthenticated access tests
  test("Get profile without auth", async () => {
    const res = await api("/api/profile");
    await expectStatus(res, 401);
  });

  test("Search jobs without auth", async () => {
    const res = await api("/api/jobs/search?keywords=developer");
    await expectStatus(res, 401);
  });

  test("Get job detail without auth", async () => {
    const res = await api("/api/jobs/job-123");
    await expectStatus(res, 401);
  });

  test("List applications without auth", async () => {
    const res = await api("/api/applications");
    await expectStatus(res, 401);
  });

  test("Upload CV without auth", async () => {
    const form = new FormData();
    form.append("cv", createTestFile("resume.pdf", "Sample CV content", "application/pdf"));
    const res = await api("/api/profile/upload-cv", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  test("Score CV without auth", async () => {
    const form = new FormData();
    const res = await api("/api/cv/score", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  test("Generate CV without auth", async () => {
    const res = await api("/api/cv/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        email: "john@example.com",
        target_role: "Developer",
        summary: "Test",
        skills: ["Test"],
        experience: [{ company: "Test", role: "Dev", duration: "1 year", description: "Test" }],
        education: [{ institution: "Test", degree: "BS", year: "2020" }],
      }),
    });
    await expectStatus(res, 401);
  });

  test("Improve CV without auth", async () => {
    const res = await api("/api/cv/improve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "Sample CV",
        target_role: "Developer",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Generate cover letter without auth", async () => {
    const res = await api("/api/cover-letter/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant_name: "John Doe",
        job_title: "Developer",
        company_name: "Tech Corp",
        job_description: "Job posting",
        cv_summary: "CV summary",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Match jobs without auth", async () => {
    const res = await api("/api/jobs/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "Sample CV",
        jobs: [{ id: "1", title: "Job", description: "Desc", company: "Corp" }],
      }),
    });
    await expectStatus(res, 401);
  });

  test("Export CV as PDF without auth", async () => {
    const res = await api("/api/cv/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Sample CV",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Parse CV file without auth", async () => {
    const form = new FormData();
    form.append("cv", createTestFile("resume.pdf", "Sample CV", "application/pdf"));
    const res = await api("/api/cv/parse", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  test("Export cover letter as PDF without auth", async () => {
    const res = await api("/api/cover-letter/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Sample letter",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Analyze career longevity without auth", async () => {
    const res = await api("/api/longevity/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "Sample CV",
      }),
    });
    await expectStatus(res, 401);
  });
});
