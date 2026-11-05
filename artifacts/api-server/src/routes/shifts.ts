import { getAuth } from "@clerk/express";
import { db, shiftsTable, type ShiftRecord } from "@workspace/db";
import {
  CreateManualShiftBody,
  CreateManualShiftResponse,
  DeleteShiftParams,
  EndShiftParams,
  EndShiftResponse,
  GetDashboardSummaryResponse,
  ListShiftsQueryParams,
  ListShiftsResponse,
  StartShiftBody,
  StartShiftResponse,
} from "@workspace/api-zod";
import {
  and,
  desc,
  eq,
  gt,
  isNull,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const WEEKLY_RECENT_LIMIT = 5;

function currentUserId(res: { locals: Record<string, unknown> }): string {
  return res.locals.userId as string;
}

function toApiShift(row: ShiftRecord) {
  const endTime = row.endedAt ?? new Date();
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    hourlyRateCents: row.hourlyRateCents,
    notes: row.notes,
    durationSeconds: Math.max(
      0,
      Math.floor((endTime.getTime() - row.startedAt.getTime()) / 1000),
    ),
    createdAt: row.createdAt,
  };
}

function weekStartUtc(now: Date): Date {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
    ),
  );
}

router.use(requireAuth);

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const userId = currentUserId(res);
  const now = new Date();
  const weekStart = weekStartUtc(now);

  const [active] = await db
    .select()
    .from(shiftsTable)
    .where(and(eq(shiftsTable.ownerId, userId), isNull(shiftsTable.endedAt)))
    .limit(1);

  const [totals] = await db
    .select({
      totalSeconds: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(${shiftsTable.endedAt}, NOW()) - ${shiftsTable.startedAt}))), 0)`,
      totalPayCents: sql<number>`COALESCE(SUM(ROUND(EXTRACT(EPOCH FROM (COALESCE(${shiftsTable.endedAt}, NOW()) - ${shiftsTable.startedAt})) * ${shiftsTable.hourlyRateCents} / 3600)), 0)`,
      weekSeconds: sql<number>`COALESCE(SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(${shiftsTable.endedAt}, NOW()) - GREATEST(${shiftsTable.startedAt}, ${weekStart}))), 0)), 0)`,
      weekPayCents: sql<number>`COALESCE(SUM(ROUND(GREATEST(EXTRACT(EPOCH FROM (COALESCE(${shiftsTable.endedAt}, NOW()) - GREATEST(${shiftsTable.startedAt}, ${weekStart}))), 0) * ${shiftsTable.hourlyRateCents} / 3600)), 0)`,
    })
    .from(shiftsTable)
    .where(eq(shiftsTable.ownerId, userId));

  const recentRows = await db
    .select()
    .from(shiftsTable)
    .where(eq(shiftsTable.ownerId, userId))
    .orderBy(desc(shiftsTable.startedAt))
    .limit(WEEKLY_RECENT_LIMIT);

  res.json(
    GetDashboardSummaryResponse.parse({
      activeShift: active ? toApiShift(active) : null,
      weekHours: Number((Number(totals?.weekSeconds ?? 0) / 3600).toFixed(2)),
      weekPayCents: Math.round(Number(totals?.weekPayCents ?? 0)),
      totalHours: Number(
        (Number(totals?.totalSeconds ?? 0) / 3600).toFixed(2),
      ),
      totalPayCents: Math.round(Number(totals?.totalPayCents ?? 0)),
      recentShifts: recentRows.map(toApiShift),
    }),
  );
});

router.get("/shifts", async (req, res): Promise<void> => {
  const query = ListShiftsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(shiftsTable)
    .where(eq(shiftsTable.ownerId, currentUserId(res)))
    .orderBy(desc(shiftsTable.startedAt))
    .limit(query.data.limit)
    .offset(query.data.offset);

  res.json(ListShiftsResponse.parse(rows.map(toApiShift)));
});

router.post("/shifts/start", async (req, res): Promise<void> => {
  const body = StartShiftBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = currentUserId(res);
  const now = new Date();

  try {
    const [row] = await db
      .insert(shiftsTable)
      .values({
        ownerId: userId,
        startedAt: now,
        hourlyRateCents: body.data.hourlyRateCents,
        notes: body.data.notes?.trim() || null,
      })
      .returning();

    res.status(201).json(StartShiftResponse.parse(toApiShift(row)));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "You already have an active shift." });
      return;
    }
    throw error;
  }
});

router.post("/shifts", async (req, res): Promise<void> => {
  const body = CreateManualShiftBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { startedAt, endedAt, hourlyRateCents, notes } = body.data;
  const now = new Date();
  if (endedAt <= startedAt || startedAt > now || endedAt > now) {
    res.status(400).json({
      error: "A completed shift must have valid times in the past.",
    });
    return;
  }

  const userId = currentUserId(res);
  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`,
    );
    const [overlap] = await tx
      .select({ id: shiftsTable.id })
      .from(shiftsTable)
      .where(
        and(
          eq(shiftsTable.ownerId, userId),
          lt(shiftsTable.startedAt, endedAt),
          or(isNull(shiftsTable.endedAt), gt(shiftsTable.endedAt, startedAt)),
        ),
      )
      .limit(1);
    if (overlap) return null;

    const [row] = await tx
      .insert(shiftsTable)
      .values({
        ownerId: userId,
        startedAt,
        endedAt,
        hourlyRateCents,
        notes: notes?.trim() || null,
      })
      .returning();
    return row;
  });

  if (!created) {
    res.status(409).json({
      error: "This shift overlaps another shift in your history.",
    });
    return;
  }

  res.status(201).json(CreateManualShiftResponse.parse(toApiShift(created)));
});

router.post("/shifts/:id/end", async (req, res): Promise<void> => {
  const params = EndShiftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = currentUserId(res);
  const ended = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`,
    );
    const [row] = await tx
      .update(shiftsTable)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(shiftsTable.id, params.data.id),
          eq(shiftsTable.ownerId, userId),
          isNull(shiftsTable.endedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!ended) {
    res.status(404).json({ error: "Active shift not found." });
    return;
  }

  res.json(EndShiftResponse.parse(toApiShift(ended)));
});

router.delete("/shifts/:id", async (req, res): Promise<void> => {
  const params = DeleteShiftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(shiftsTable)
    .where(
      and(
        eq(shiftsTable.id, params.data.id),
        eq(shiftsTable.ownerId, currentUserId(res)),
        isNotNull(shiftsTable.endedAt),
      ),
    )
    .returning({ id: shiftsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Shift not found." });
    return;
  }

  res.sendStatus(204);
});

export default router;
