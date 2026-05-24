export const routes = {
  home: "/",
  admin: "/admin",
  confirmation: (orderId: string): string => `/confirmation/${orderId}`,
};
