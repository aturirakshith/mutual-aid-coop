import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  mobile: z.string().length(10),
  password: z.string().min(1),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        mobile: { label: "Mobile", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { mobile, password } = parsed.data;

        const user = await prisma.user.findFirst({
          where: { mobile, active: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          groupId: user.groupId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.mustChangePassword = (user as { mustChangePassword: boolean }).mustChangePassword;
        token.groupId = (user as { groupId: string }).groupId;
        token.mobile = (user as { mobile: string }).mobile;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      session.user.groupId = token.groupId as string;
      session.user.mobile = token.mobile as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});

// Extend next-auth types
declare module "next-auth" {
  interface User {
    role: string;
    mustChangePassword: boolean;
    groupId: string;
    mobile: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
      mustChangePassword: boolean;
      groupId: string;
      mobile: string;
    };
  }
}
