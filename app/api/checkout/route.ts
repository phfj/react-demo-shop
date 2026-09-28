// FAKE Merchant backend: stands in for @transxact/node until Step 7.

// Prices live on the server. The browser only ever sends an orderId.
const ORDERS: Record<string, { totalCents: number }> = {
    order_1: { totalCents: 2500 },
};

// How many times each session has been looked up, so we can pretend it's "pending" for a bit.
const lookups = new Map<string, number>();

// CREATE: called when the Customer clicks Pay.
export async function POST(request: Request) {
    const idempotencyKey = request.headers.get("Idempotency-Key");
    const { orderId } = await request.json();
    console.log(`[create] orderId=${orderId} idempotencyKey=${idempotencyKey}`);

    if (!ORDERS[orderId]) {
        return Response.json({ error: "unknown_order" }, { status: 404 });
    }

    const id = `cs_fake_${Date.now()}`;
    // Real Transxact would return its own hosted page URL. We point at our fake one.
    const hostedUrl = new URL(`/fake-hosted?session_id=${id}`, request.url).href;
    return Response.json({ id, hostedUrl });
}

// RETRIEVE: called by the Return page to ask what actually happened.
export async function GET(request: Request) {
    const id = new URL(request.url).searchParams.get("session_id");
    if (!id) return Response.json({ error: "missing_session_id" }, { status: 400 });

    const count = (lookups.get(id) ?? 0) + 1;
    lookups.set(id, count);

    // The outcome is encoded at the end of the id by the fake hosted page, e.g. cs_fake_123_succeeded
    const outcome = id.split("_").pop();
    const finalStatus =
        outcome === "succeeded" || outcome === "failed" || outcome === "cancelled" ? outcome : "pending";

    // Pretend the payment is still processing for the first 2 lookups.
    const status = count < 3 ? "pending" : finalStatus;
    console.log(`[retrieve] ${id} lookup #${count} -> ${status}`);
    return Response.json({ id, status });
}