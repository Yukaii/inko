import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      userId: string;
      email: string;
    };
  }
}
