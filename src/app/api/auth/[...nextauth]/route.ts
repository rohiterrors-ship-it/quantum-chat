import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function generateHandle(base: string | null | undefined) {
  const core = (base || "user").split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "user";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${core}-${suffix}`;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, copy over id and handle from the freshly created user
      if (user) {
        token.id = (user as any).id;
        token.handle = (user as any).handle;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token) return session;

      const sUser = session.user as any;

      // Always expose id from token
      sUser.id = token.id;

      // If token already has a handle, just use it
      if (token.handle) {
        sUser.handle = token.handle;
        return session;
      }

      // Backfill for older users without a handle yet
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });

          if (dbUser) {
            let handle = dbUser.handle;

            if (!handle) {
              handle = generateHandle(dbUser.email ?? dbUser.name ?? undefined);

              // Best-effort uniqueness, similar to createUser event
              for (let i = 0; i < 5; i++) {
                try {
                  const updated = await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { handle },
                  });
                  handle = updated.handle ?? handle;
                  break;
                } catch {
                  handle = generateHandle(dbUser.email ?? dbUser.name ?? undefined);
                }
              }
            }

            (token as any).handle = handle;
            sUser.handle = handle;
          }
        } catch {
          // If anything goes wrong here, just return the session without a handle
        }
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Ensure newly created users get a unique handle
      if (!(user as any).handle) {
        let handle = generateHandle(user.email ?? user.name ?? undefined);
        // Best-effort: retry a few times if collision
        for (let i = 0; i < 5; i++) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { handle },
            });
            break;
          } catch (err) {
            handle = generateHandle(user.email ?? user.name ?? undefined);
          }
        }
      }
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
