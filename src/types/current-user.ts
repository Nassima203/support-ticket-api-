import { Role } from "@prisma/client";

// L'utilisateur connecté, rempli par le middleware authenticate dans req.user
export type CurrentUser = {
  id: number;
  email: string;
  role: Role;
};
