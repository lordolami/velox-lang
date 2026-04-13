export const name = "send-order-email";
export async function handle(payload) {
  console.log("email job", payload.orderId);
}
