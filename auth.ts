import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Pin the secret explicitly. If AUTH_SECRET is unset (or changes between
  // deploys) NextAuth cannot verify existing JWTs and silently signs everyone
  // out — the #1 cause of "I have to log in every time". Must be a stable value
  // in the deploy environment (e.g. Vercel) for sessions to survive.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
    // Sliding 1-year window: maxAge is the cookie lifetime, updateAge re-issues
    // the cookie at most once a day. Because every visit slides the expiry
    // forward, an active user effectively stays signed in until they sign out.
    maxAge: 365 * 24 * 60 * 60, // 1 year
    updateAge: 24 * 60 * 60,    // refresh the session cookie daily
  },
  callbacks: {
    jwt({ token, account }) {
      if (account) token.sub = account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
