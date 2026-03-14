import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile } from "./helpers";

// Set Adzuna credentials for tests if not already set
process.env.ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || "98619faa";
process.env.ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || "2899cb384058f7a2a293c3ff47b84359";

describe("API Integration Tests", () => {
  let authToken: string;
  let applicationId: string;

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
    form.append("file", createTestFile("resume.pdf", "Sample CV content", "application/pdf"));
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

  // Unauthenticated access tests
  test("Get profile without auth", async () => {
    const res = await api("/api/profile");
    await expectStatus(res, 401);
  });

  test("Search jobs without auth", async () => {
    const res = await api("/api/jobs/search?keywords=developer");
    await expectStatus(res, 401);
  });

  test("List applications without auth", async () => {
    const res = await api("/api/applications");
    await expectStatus(res, 401);
  });
});
