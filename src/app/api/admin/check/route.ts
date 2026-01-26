import {
  getAdminUser,
  unauthorizedResponse,
  successResponse,
} from "@/lib/server/auth";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  
  return successResponse({ isAdmin: admin.isAdmin });
}
