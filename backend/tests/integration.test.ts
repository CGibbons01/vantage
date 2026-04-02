import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile } from "./helpers";

// Set Adzuna credentials for tests if not already set
process.env.ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || "98619faa";
process.env.ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || "2899cb384058f7a2a293c3ff47b84359";

describe("API Integration Tests", () => {
  let authToken: string;
  let authUser: any;
  let applicationId: string;

  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    authUser = user;
    expect(authToken).toBeDefined();
    expect(authUser).toBeDefined();
    expect(authUser.id).toBeDefined();
  });

  // Profile endpoints
  test("Get user profile", async () => {
    const res = await authenticatedApi("/api/profile", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.userId).toBeDefined();
    expect(data.userId).toBe(authUser.id);
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
    expect(data.userId).toBe(authUser.id);
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

  test("Upload CV - missing file", async () => {
    const form = new FormData();
    const res = await authenticatedApi("/api/profile/upload-cv", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 400);
  });

  // Job endpoints
  test("Search jobs with keywords", async () => {
    const res = await authenticatedApi("/api/jobs/search?keywords=developer&page=1", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.jobs).toBeDefined();
    expect(data.total).toBeDefined();
    expect(data.page).toBeDefined();
  });

  test("Search jobs with location filter", async () => {
    const res = await authenticatedApi("/api/jobs/search?keywords=engineer&location=london&page=1", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.jobs).toBeDefined();
  });

  test("Search jobs - default page", async () => {
    const res = await authenticatedApi("/api/jobs/search?keywords=developer", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.page).toBeDefined();
  });

  // Job Matching endpoint
  test("Match CV against jobs", async () => {
    const res = await authenticatedApi("/api/jobs/match", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "John Doe\nSoftware Engineer with 5 years experience\nSkills: JavaScript, TypeScript, React, Node.js",
        jobs: [
          {
            id: "job-001",
            title: "Senior Developer",
            description: "Looking for a developer with JavaScript and React experience",
            company: "Tech Corp",
            required_skills: ["JavaScript", "React"],
          },
          {
            id: "job-002",
            title: "Backend Engineer",
            description: "Node.js backend position",
            company: "Another Corp",
            required_skills: ["Node.js"],
          },
        ],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.matches).toBeDefined();
    expect(Array.isArray(data.matches)).toBe(true);
  });

  test("Match CV - missing cv_text", async () => {
    const res = await authenticatedApi("/api/jobs/match", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobs: [
          {
            id: "job-001",
            title: "Developer",
            description: "Some job",
            company: "Tech Corp",
          },
        ],
      }),
    });
    await expectStatus(res, 400);
  });

  test("Match CV - missing jobs array", async () => {
    const res = await authenticatedApi("/api/jobs/match", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "Some CV content",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Match CV - missing required job field", async () => {
    const res = await authenticatedApi("/api/jobs/match", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "Some CV",
        jobs: [
          {
            id: "job-001",
            title: "Developer",
            // missing required: description, company
          },
        ],
      }),
    });
    await expectStatus(res, 400);
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
    expect(data.userId).toBe(authUser.id);
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

  test("Update application - forbidden (not owned by user)", async () => {
    const { token: token2 } = await signUpTestUser();
    const res = await authenticatedApi(`/api/applications/${applicationId}`, token2, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
    await expectStatus(res, 403);
  });

  test("Delete application", async () => {
    const res = await authenticatedApi(`/api/applications/${applicationId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Delete application - forbidden (not owned by user)", async () => {
    // Create an application with first user
    const createRes = await authenticatedApi("/api/applications", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: "job-456",
        job_title: "Backend Developer",
        company: "Another Corp",
        location: "New York",
        job_url: "https://example.com/jobs/456",
      }),
    });
    const appId = (await createRes.json()).id;

    // Try to delete with second user
    const { token: token2 } = await signUpTestUser();
    const res = await authenticatedApi(`/api/applications/${appId}`, token2, {
      method: "DELETE",
    });
    await expectStatus(res, 403);

    // Clean up: delete with correct user
    await authenticatedApi(`/api/applications/${appId}`, authToken, {
      method: "DELETE",
    });
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

  // Application Status Update endpoint
  test("Update application status", async () => {
    // Create an application first
    const createRes = await authenticatedApi("/api/applications", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: "job-status-test",
        job_title: "Developer",
        company: "Status Test Corp",
        location: "Remote",
        job_url: "https://example.com/jobs/status",
      }),
    });
    const appId = (await createRes.json()).id;

    const res = await authenticatedApi(`/api/applications/${appId}/status`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "interviewing",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.status).toBe("interviewing");

    // Clean up
    await authenticatedApi(`/api/applications/${appId}`, authToken, {
      method: "DELETE",
    });
  });

  test("Update application status - missing status field", async () => {
    // Create an application first
    const createRes = await authenticatedApi("/api/applications", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: "job-status-missing",
        job_title: "Developer",
        company: "Missing Field Corp",
        location: "Remote",
        job_url: "https://example.com/jobs/missing",
      }),
    });
    const appId = (await createRes.json()).id;

    const res = await authenticatedApi(`/api/applications/${appId}/status`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);

    // Clean up
    await authenticatedApi(`/api/applications/${appId}`, authToken, {
      method: "DELETE",
    });
  });

  test("Update application status - not found", async () => {
    const res = await authenticatedApi("/api/applications/00000000-0000-0000-0000-000000000000/status", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
    await expectStatus(res, 404);
  });

  test("Update application status - forbidden (not owned by user)", async () => {
    // Create an application with first user
    const createRes = await authenticatedApi("/api/applications", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: "job-status-forbidden",
        job_title: "Developer",
        company: "Forbidden Corp",
        location: "Remote",
        job_url: "https://example.com/jobs/forbidden",
      }),
    });
    const appId = (await createRes.json()).id;

    // Try to update with second user
    const { token: token2 } = await signUpTestUser();
    const res = await authenticatedApi(`/api/applications/${appId}/status`, token2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
    await expectStatus(res, 403);

    // Clean up: delete with correct user
    await authenticatedApi(`/api/applications/${appId}`, authToken, {
      method: "DELETE",
    });
  });

  test("Update application status - invalid UUID format", async () => {
    const res = await authenticatedApi("/api/applications/invalid-uuid/status", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
    await expectStatus(res, 400);
  });

  // CV Parse endpoint - multipart file upload
  test("Parse CV file", async () => {
    const fileContent = "John Doe\nSoftware Engineer at Tech Corp\nSkills: JavaScript, TypeScript, React, Node.js";
    const file = createTestFile("resume.pdf", fileContent, "application/pdf");
    const form = new FormData();
    form.append("cv", file);

    const res = await authenticatedApi("/api/cv/parse", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.text).toBeDefined();
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

  // CV Generation AI endpoint
  test("Generate CV", async () => {
    const res = await authenticatedApi("/api/cv/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        email: "john@example.com",
        target_role: "Senior Software Engineer",
        experience: [
          {
            title: "Software Engineer",
            company: "Tech Corp",
            duration: "2 years",
            description: "Full-stack development",
          },
        ],
        skills: ["JavaScript", "TypeScript", "React", "Node.js"],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.cv_text).toBeDefined();
    expect(data.sections).toBeDefined();
  });

  test("Generate CV - missing required fields", async () => {
    const res = await authenticatedApi("/api/cv/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        // missing required: email, target_role
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
        cv_text: "John Doe\nSoftware Developer with 5 years experience\nSkills: JavaScript, TypeScript, React",
        target_role: "Senior Developer",
        focus_areas: ["impact_statements", "keywords"],
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.improved_cv_text).toBeDefined();
    expect(data.suggestions).toBeDefined();
    expect(data.score_before).toBeDefined();
    expect(data.score_after).toBeDefined();
  });

  test("Improve CV - missing required fields", async () => {
    const res = await authenticatedApi("/api/cv/improve", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // missing required: cv_text, target_role
      }),
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
  });

  test("Export CV as PDF - missing required content field", async () => {
    const res = await authenticatedApi("/api/cv/export-pdf", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "My CV",
      }),
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
        cv_summary: "Experienced full-stack developer with 5 years in software development\nSkills: JavaScript, TypeScript, React, Node.js",
        tone: "professional",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.cover_letter).toBeDefined();
    expect(data.word_count).toBeDefined();
  });

  test("Generate cover letter - missing required fields", async () => {
    const res = await authenticatedApi("/api/cover-letter/generate", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_title: "Senior Developer",
        // missing required: applicant_name, company_name, job_description, cv_summary
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
        content: "Dear Hiring Manager,\nI am interested in the Senior Developer position at Tech Corp.",
        title: "John_Doe_Cover_Letter",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Export cover letter as PDF - missing required content field", async () => {
    const res = await authenticatedApi("/api/cover-letter/export-pdf", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "My Cover Letter",
      }),
    });
    await expectStatus(res, 400);
  });

  // Unauthenticated access tests
  test("Get profile without auth", async () => {
    const res = await api("/api/profile");
    await expectStatus(res, 401);
  });

  test("Update profile without auth", async () => {
    const res = await api("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: "Senior Developer",
        summary: "Test summary",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Search jobs without auth", async () => {
    const res = await api("/api/jobs/search?keywords=developer");
    await expectStatus(res, 401);
  });

  test("Match jobs without auth", async () => {
    const res = await api("/api/jobs/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv_text: "Some CV",
        jobs: [
          {
            id: "job-001",
            title: "Developer",
            description: "Job description",
            company: "Tech Corp",
          },
        ],
      }),
    });
    await expectStatus(res, 401);
  });

  test("List applications without auth", async () => {
    const res = await api("/api/applications");
    await expectStatus(res, 401);
  });

  test("Create application without auth", async () => {
    const res = await api("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: "job-123",
        job_title: "Developer",
        company: "Tech Corp",
        location: "London",
        job_url: "https://example.com/jobs/123",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update application without auth", async () => {
    const res = await api("/api/applications/00000000-0000-0000-0000-000000000000", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
    await expectStatus(res, 401);
  });

  test("Delete application without auth", async () => {
    const res = await api("/api/applications/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Update application status without auth", async () => {
    const res = await api("/api/applications/00000000-0000-0000-0000-000000000000/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    });
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

  test("Generate CV without auth", async () => {
    const res = await api("/api/cv/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        email: "john@example.com",
        target_role: "Developer",
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
        target_role: "Senior Developer",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Parse CV file without auth", async () => {
    const fileContent = "Sample CV";
    const file = createTestFile("resume.pdf", fileContent, "application/pdf");
    const form = new FormData();
    form.append("cv", file);

    const res = await api("/api/cv/parse", {
      method: "POST",
      body: form,
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
        job_description: "Job description",
        cv_summary: "CV content",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Export CV as PDF without auth", async () => {
    const res = await api("/api/cv/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "CV content",
        title: "My_CV",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Export cover letter as PDF without auth", async () => {
    const res = await api("/api/cover-letter/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Sample letter",
        title: "My_Cover_Letter",
      }),
    });
    await expectStatus(res, 401);
  });
});
