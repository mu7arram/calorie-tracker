import { NextRequest, NextResponse } from "next/server";
import { getDailyHistory, isValidDateString } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 90;

function shiftDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDaysInclusive(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const diffMs = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const endDateParam = params.get("endDate");
  const daysParam = params.get("days");

  let fromDate: string;
  let toDate: string;

  if (fromParam || toParam) {
    if (
      !fromParam ||
      !toParam ||
      !isValidDateString(fromParam) ||
      !isValidDateString(toParam)
    ) {
      return NextResponse.json(
        { error: "'from' and 'to' must both be valid YYYY-MM-DD dates" },
        { status: 400 }
      );
    }

    const span = diffDaysInclusive(fromParam, toParam);
    if (span < 1 || span > MAX_RANGE_DAYS) {
      return NextResponse.json(
        {
          error: `Date range must be between 1 and ${MAX_RANGE_DAYS} days`,
        },
        { status: 400 }
      );
    }

    fromDate = fromParam;
    toDate = toParam;
  } else {
    if (!endDateParam || !isValidDateString(endDateParam)) {
      return NextResponse.json(
        { error: "'endDate' must be a valid YYYY-MM-DD date" },
        { status: 400 }
      );
    }

    const parsedDays = daysParam ? Number(daysParam) : 7;
    if (
      !Number.isInteger(parsedDays) ||
      parsedDays < 1 ||
      parsedDays > MAX_RANGE_DAYS
    ) {
      return NextResponse.json(
        { error: `'days' must be a whole number between 1 and ${MAX_RANGE_DAYS}` },
        { status: 400 }
      );
    }

    toDate = endDateParam;
    fromDate = shiftDateString(endDateParam, -(parsedDays - 1));
  }

  try {
    const history = await getDailyHistory(fromDate, toDate);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Failed to fetch daily history:", error);
    return NextResponse.json(
      { error: "Failed to load food history" },
      { status: 500 }
    );
  }
}
