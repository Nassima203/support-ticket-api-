import { Request, Response } from "express";
import { parseId } from "../../lib/parse-id";
import { validate } from "../../lib/validate";
import * as usersService from "./users.service";
import { changeRoleSchema, createUserSchema, listUsersQuerySchema, setStatusSchema } from "./users.schemas";

// POST /users
export async function create(req: Request, res: Response) {
  const { email, name, role } = validate(createUserSchema, req.body ?? {});
  const user = await usersService.createUser(req.user!, email, name ?? null, role);
  res.status(201).json(user);
}

// GET /users
export async function list(req: Request, res: Response) {
  const query = validate(listUsersQuerySchema, req.query);
  res.json(await usersService.listUsers(query));
}

// POST /users/:id/resend-invitation
export async function resendInvitation(req: Request, res: Response) {
  const id = parseId(req.params.id);
  await usersService.resendInvitation(req.user!, id);
  res.json({ message: "Invitation renvoyée" });
}

// PATCH /users/:id/status
export async function setStatus(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { isActive } = validate(setStatusSchema, req.body ?? {});
  const user = await usersService.setUserActive(req.user!, id, isActive);
  res.json(user);
}

// PATCH /users/:id/role
export async function changeRole(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { role } = validate(changeRoleSchema, req.body ?? {});
  const user = await usersService.changeUserRole(req.user!, id, role);
  res.json(user);
}
