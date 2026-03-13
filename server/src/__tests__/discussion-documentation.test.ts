import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Task 6: Add unit tests for discussion documentation
 * 
 * These tests verify that the discussion API documentation added in Task 1
 * is complete and correct in skills/paperclip/references/api-reference.md
 * 
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
 */

describe("Discussion API Documentation", () => {
  const apiReferencePath = path.join(process.cwd(), "skills/paperclip/references/api-reference.md");
  let apiReferenceContent: string;

  // Read the API reference file once for all tests
  try {
    apiReferenceContent = fs.readFileSync(apiReferencePath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read API reference file at ${apiReferencePath}: ${error}`);
  }

  describe("discussion section presence", () => {
    it("contains a dedicated Discussions section", () => {
      // Validates Requirement 1.1: THE API_Reference SHALL include a dedicated section documenting the discussions feature
      expect(apiReferenceContent).toContain("## Discussions");
    });

    it("includes usage guidance for discussions vs task comments", () => {
      // Validates Requirement 1.8: THE API_Reference SHALL explain when to use discussions versus task comments
      expect(apiReferenceContent).toContain("When to Use Discussions");
      expect(apiReferenceContent).toContain("Use discussions for:");
      expect(apiReferenceContent).toContain("Use task comments for:");
    });
  });

  describe("endpoint documentation", () => {
    it("documents GET /api/companies/:companyId/discussions endpoint", () => {
      // Validates Requirement 1.2: THE API_Reference SHALL document the endpoint GET /api/companies/:companyId/discussions
      expect(apiReferenceContent).toMatch(/GET.*\/api\/companies\/:companyId\/discussions/);
    });

    it("documents POST /api/companies/:companyId/discussions endpoint", () => {
      // Validates Requirement 1.3: THE API_Reference SHALL document the endpoint POST /api/companies/:companyId/discussions
      expect(apiReferenceContent).toMatch(/POST.*\/api\/companies\/:companyId\/discussions/);
    });

    it("documents GET /api/discussions/:id endpoint", () => {
      // Validates Requirement 1.4: THE API_Reference SHALL document the endpoint GET /api/discussions/:id
      expect(apiReferenceContent).toMatch(/GET.*\/api\/discussions\/:id/);
    });

    it("documents POST /api/discussions/:id/comments endpoint", () => {
      // Validates Requirement 1.5: THE API_Reference SHALL document the endpoint POST /api/discussions/:id/comments
      expect(apiReferenceContent).toMatch(/POST.*\/api\/discussions\/:id\/comments/);
    });

    it("documents GET /api/discussions/:id/comments endpoint", () => {
      // Validates Requirement 1.6: THE API_Reference SHALL document the endpoint GET /api/discussions/:id/comments
      expect(apiReferenceContent).toMatch(/GET.*\/api\/discussions\/:id\/comments/);
    });
  });

  describe("example payloads", () => {
    it("includes valid JSON examples for discussion creation", () => {
      // Validates Requirement 1.7: THE API_Reference SHALL include example request and response payloads
      
      // Find the discussion creation section
      const createDiscussionMatch = apiReferenceContent.match(
        /POST \/api\/companies\/\{companyId\}\/discussions[\s\S]*?```json\s*([\s\S]*?)```/
      );
      
      expect(createDiscussionMatch).toBeTruthy();
      
      if (createDiscussionMatch) {
        const jsonExample = createDiscussionMatch[1];
        
        // Verify it's valid JSON
        expect(() => JSON.parse(jsonExample)).not.toThrow();
        
        // Verify it contains expected fields
        const parsed = JSON.parse(jsonExample);
        expect(parsed).toHaveProperty("title");
      }
    });

    it("includes valid JSON examples for discussion response", () => {
      // Validates Requirement 1.7: THE API_Reference SHALL include example request and response payloads
      
      // Find response examples in the discussion section
      const responseMatches = apiReferenceContent.matchAll(/Response \(\d+\):[\s\S]*?```json\s*([\s\S]*?)```/g);
      const matches = Array.from(responseMatches);
      
      expect(matches.length).toBeGreaterThan(0);
      
      // Verify at least one response example is valid JSON with discussion fields
      let foundValidDiscussionResponse = false;
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.id && parsed.companyId && parsed.title) {
            foundValidDiscussionResponse = true;
            expect(parsed).toHaveProperty("id");
            expect(parsed).toHaveProperty("companyId");
            expect(parsed).toHaveProperty("title");
            expect(parsed).toHaveProperty("authorAgentId");
            expect(parsed).toHaveProperty("authorUserId");
            expect(parsed).toHaveProperty("createdAt");
            expect(parsed).toHaveProperty("updatedAt");
            break;
          }
        } catch {
          // Skip invalid JSON or non-discussion responses
          continue;
        }
      }
      
      expect(foundValidDiscussionResponse).toBe(true);
    });

    it("includes valid JSON examples for comment creation", () => {
      // Validates Requirement 1.7: THE API_Reference SHALL include example request and response payloads
      
      // Find comment creation section
      const addCommentMatch = apiReferenceContent.match(
        /POST \/api\/discussions\/\{discussionId\}\/comments[\s\S]*?```json\s*([\s\S]*?)```/
      );
      
      expect(addCommentMatch).toBeTruthy();
      
      if (addCommentMatch) {
        const jsonExample = addCommentMatch[1];
        
        // Verify it's valid JSON
        expect(() => JSON.parse(jsonExample)).not.toThrow();
        
        // Verify it contains expected fields
        const parsed = JSON.parse(jsonExample);
        expect(parsed).toHaveProperty("body");
      }
    });

    it("includes valid JSON examples for comment response", () => {
      // Validates Requirement 1.7: THE API_Reference SHALL include example request and response payloads
      
      // Find comment response examples
      const commentResponseMatch = apiReferenceContent.match(
        /POST \/api\/discussions\/\{discussionId\}\/comments[\s\S]*?Response \(\d+\):[\s\S]*?```json\s*([\s\S]*?)```/
      );
      
      expect(commentResponseMatch).toBeTruthy();
      
      if (commentResponseMatch) {
        const jsonExample = commentResponseMatch[1];
        
        // Verify it's valid JSON
        expect(() => JSON.parse(jsonExample)).not.toThrow();
        
        // Verify it contains expected comment fields
        const parsed = JSON.parse(jsonExample);
        expect(parsed).toHaveProperty("id");
        expect(parsed).toHaveProperty("discussionId");
        expect(parsed).toHaveProperty("body");
        expect(parsed).toHaveProperty("authorAgentId");
        expect(parsed).toHaveProperty("authorUserId");
      }
    });
  });

  describe("data model documentation", () => {
    it("documents discussion data model with all required fields", () => {
      // Validates Requirement 1.9: THE API_Reference SHALL document that discussions support both agent and user authors
      
      // Find the Discussion data model section
      const dataModelMatch = apiReferenceContent.match(
        /Discussion Data Model[\s\S]*?\*\*Discussion:\*\*[\s\S]*?```json\s*([\s\S]*?)```/
      );
      
      expect(dataModelMatch).toBeTruthy();
      
      if (dataModelMatch) {
        const jsonExample = dataModelMatch[1];
        
        // Verify it's valid JSON
        expect(() => JSON.parse(jsonExample)).not.toThrow();
        
        const parsed = JSON.parse(jsonExample);
        expect(parsed).toHaveProperty("id");
        expect(parsed).toHaveProperty("companyId");
        expect(parsed).toHaveProperty("title");
        expect(parsed).toHaveProperty("description");
        expect(parsed).toHaveProperty("authorAgentId");
        expect(parsed).toHaveProperty("authorUserId");
        expect(parsed).toHaveProperty("createdAt");
        expect(parsed).toHaveProperty("updatedAt");
      }
    });

    it("documents comment data model with all required fields", () => {
      // Validates Requirement 1.9: THE API_Reference SHALL document that discussions support both agent and user authors
      
      // Find the Discussion Comment data model section
      const commentModelMatch = apiReferenceContent.match(
        /\*\*Discussion Comment:\*\*[\s\S]*?```json\s*([\s\S]*?)```/
      );
      
      expect(commentModelMatch).toBeTruthy();
      
      if (commentModelMatch) {
        const jsonExample = commentModelMatch[1];
        
        // Verify it's valid JSON
        expect(() => JSON.parse(jsonExample)).not.toThrow();
        
        const parsed = JSON.parse(jsonExample);
        expect(parsed).toHaveProperty("id");
        expect(parsed).toHaveProperty("companyId");
        expect(parsed).toHaveProperty("discussionId");
        expect(parsed).toHaveProperty("body");
        expect(parsed).toHaveProperty("authorAgentId");
        expect(parsed).toHaveProperty("authorUserId");
        expect(parsed).toHaveProperty("createdAt");
        expect(parsed).toHaveProperty("updatedAt");
      }
    });

    it("documents author fields for both agents and users", () => {
      // Validates Requirement 1.9: THE API_Reference SHALL document that discussions support both agent and user authors
      expect(apiReferenceContent).toContain("authorAgentId");
      expect(apiReferenceContent).toContain("authorUserId");
      expect(apiReferenceContent).toMatch(/authorAgentId.*Set if created by an agent/i);
      expect(apiReferenceContent).toMatch(/authorUserId.*Set if created by.*user/i);
    });
  });

  describe("authorization documentation", () => {
    it("documents authorization model section", () => {
      // Validates Requirement 1.10: THE API_Reference SHALL document that discussions are company-scoped with proper authorization
      expect(apiReferenceContent).toContain("Authorization Model");
    });

    it("documents that discussions are company-scoped", () => {
      // Validates Requirement 1.10: THE API_Reference SHALL document that discussions are company-scoped
      const authSection = apiReferenceContent.match(/Authorization Model[\s\S]*?(?=###|---|\n## )/);
      expect(authSection).toBeTruthy();
      
      if (authSection) {
        const authContent = authSection[0];
        expect(authContent).toMatch(/company-scoped|company boundaries/i);
      }
    });

    it("documents agent permissions for discussions", () => {
      // Validates Requirement 1.10: THE API_Reference SHALL document proper authorization
      const authSection = apiReferenceContent.match(/Authorization Model[\s\S]*?(?=###|---|\n## )/);
      expect(authSection).toBeTruthy();
      
      if (authSection) {
        const authContent = authSection[0];
        expect(authContent).toMatch(/Agents.*can read.*discussions/i);
        expect(authContent).toMatch(/Agents.*can create.*discussions/i);
        expect(authContent).toMatch(/Agents.*can comment/i);
      }
    });

    it("documents assertCompanyAccess enforcement", () => {
      // Validates Requirement 1.10: THE API_Reference SHALL document proper authorization
      expect(apiReferenceContent).toContain("assertCompanyAccess");
    });
  });

  describe("usage guidance", () => {
    it("provides examples of when to use discussions", () => {
      // Validates Requirement 1.8: THE API_Reference SHALL explain when to use discussions versus task comments
      expect(apiReferenceContent).toMatch(/company-wide announcements/i);
      expect(apiReferenceContent).toMatch(/technical discussions/i);
      expect(apiReferenceContent).toMatch(/knowledge sharing/i);
    });

    it("provides examples of when to use task comments", () => {
      // Validates Requirement 1.8: THE API_Reference SHALL explain when to use discussions versus task comments
      expect(apiReferenceContent).toMatch(/work-specific communication/i);
      expect(apiReferenceContent).toMatch(/status updates/i);
    });

    it("explains discussion persistence", () => {
      // Validates usage guidance about discussion lifecycle
      expect(apiReferenceContent).toMatch(/persist.*independently/i);
    });
  });

  describe("activity logging documentation", () => {
    it("documents activity logging section", () => {
      // Validates that activity logging is documented
      expect(apiReferenceContent).toContain("Activity Logging");
    });

    it("documents discussion.created action type", () => {
      // Validates that discussion creation is logged
      expect(apiReferenceContent).toContain("discussion.created");
    });

    it("documents discussion.comment_added action type", () => {
      // Validates that comment addition is logged
      expect(apiReferenceContent).toContain("discussion.comment_added");
    });

    it("includes valid JSON example for activity log entries", () => {
      // Validates that activity log examples are valid JSON
      
      // Find activity logging section
      const activitySection = apiReferenceContent.match(
        /Activity Logging[\s\S]*?(?=###|---|\n## )/
      );
      
      expect(activitySection).toBeTruthy();
      
      if (activitySection) {
        const activityContent = activitySection[0];
        
        // Extract JSON examples from activity section
        const jsonMatches = activityContent.matchAll(/```json\s*([\s\S]*?)```/g);
        const examples = Array.from(jsonMatches);
        
        expect(examples.length).toBeGreaterThan(0);
        
        // Verify each example is valid JSON
        for (const match of examples) {
          expect(() => JSON.parse(match[1])).not.toThrow();
          
          const parsed = JSON.parse(match[1]);
          expect(parsed).toHaveProperty("action");
          expect(parsed).toHaveProperty("entityType");
          expect(parsed).toHaveProperty("actorType");
          expect(parsed).toHaveProperty("actorId");
        }
      }
    });
  });

  describe("error handling documentation", () => {
    it("documents validation errors (422)", () => {
      // Validates that error responses are documented
      const discussionSection = apiReferenceContent.match(/## Discussions[\s\S]*?(?=\n## )/);
      expect(discussionSection).toBeTruthy();
      
      if (discussionSection) {
        const content = discussionSection[0];
        expect(content).toContain("422");
      }
    });

    it("documents authentication errors (401)", () => {
      // Validates that error responses are documented
      const discussionSection = apiReferenceContent.match(/## Discussions[\s\S]*?(?=\n## )/);
      expect(discussionSection).toBeTruthy();
      
      if (discussionSection) {
        const content = discussionSection[0];
        expect(content).toContain("401");
      }
    });

    it("documents authorization errors (403)", () => {
      // Validates that error responses are documented
      const discussionSection = apiReferenceContent.match(/## Discussions[\s\S]*?(?=\n## )/);
      expect(discussionSection).toBeTruthy();
      
      if (discussionSection) {
        const content = discussionSection[0];
        expect(content).toContain("403");
      }
    });

    it("documents not found errors (404)", () => {
      // Validates that error responses are documented
      const discussionSection = apiReferenceContent.match(/## Discussions[\s\S]*?(?=\n## )/);
      expect(discussionSection).toBeTruthy();
      
      if (discussionSection) {
        const content = discussionSection[0];
        expect(content).toContain("404");
      }
    });
  });

  describe("comprehensive example", () => {
    it("includes a complete workflow example", () => {
      // Validates that comprehensive usage examples are provided
      const discussionSection = apiReferenceContent.match(/## Discussions[\s\S]*?(?=\n## )/);
      expect(discussionSection).toBeTruthy();
      
      if (discussionSection) {
        const content = discussionSection[0];
        expect(content).toMatch(/Example.*Creating a Discussion/i);
      }
    });

    it("example workflow includes creating and commenting", () => {
      // Validates that the example shows the full discussion lifecycle
      const discussionSection = apiReferenceContent.match(/## Discussions[\s\S]*?(?=\n## )/);
      expect(discussionSection).toBeTruthy();
      
      if (discussionSection) {
        const content = discussionSection[0];
        // Should show POST to create and POST to comment
        const postMatches = content.match(/POST/g);
        expect(postMatches).toBeTruthy();
        expect(postMatches!.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("validation rules", () => {
    it("documents that title is required for discussion creation", () => {
      // Validates that validation rules are documented
      const createSection = apiReferenceContent.match(
        /POST \/api\/companies\/\{companyId\}\/discussions[\s\S]*?Validation:[\s\S]*?(?=\*\*Errors|\###)/
      );
      
      expect(createSection).toBeTruthy();
      
      if (createSection) {
        const content = createSection[0];
        expect(content).toMatch(/title.*required/i);
      }
    });

    it("documents that body is required for comment creation", () => {
      // Validates that validation rules are documented
      const commentSection = apiReferenceContent.match(
        /POST \/api\/discussions\/\{discussionId\}\/comments[\s\S]*?Validation:[\s\S]*?(?=\*\*Errors|\###)/
      );
      
      expect(commentSection).toBeTruthy();
      
      if (commentSection) {
        const content = commentSection[0];
        expect(content).toMatch(/body.*required/i);
      }
    });
  });
});
