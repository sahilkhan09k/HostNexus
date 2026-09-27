// ─────────────────────────────────────────────────────────────
// Razorpay Checkout — loads checkout.js on demand and wraps the
// modal in a promise that resolves with the signed payment result.
// ─────────────────────────────────────────────────────────────

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment was cancelled. Your booking is still reserved until the payment deadline.");
    this.name = "PaymentCancelledError";
  }
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout needs a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error("Couldn't load Razorpay Checkout. Check your connection and try again."));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}

export async function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<RazorpayResult> {
  await loadCheckout();
  const Razorpay = window.Razorpay!;

  return new Promise<RazorpayResult>((resolve, reject) => {
    let settled = false;
    let lastFailure: string | null = null;
    const rzp = new Razorpay({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountPaise,
      currency: "INR",
      name: "HostNexus Escrow",
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: "#111827" },
      handler: (result: RazorpayResult) => {
        settled = true;
        resolve(result);
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          reject(lastFailure ? new Error(`Payment failed: ${lastFailure}`) : new PaymentCancelledError());
        },
      },
    });
    // Checkout lets the user retry inside the modal after a failure, so only
    // remember the reason here; the promise settles on success or on close.
    rzp.on("payment.failed", (resp) => {
      lastFailure = resp.error?.description || "the bank declined the payment";
    });
    rzp.open();
  });
}
