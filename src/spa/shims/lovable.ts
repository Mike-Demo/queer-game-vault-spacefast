/**
 * Preview shim for `@/integrations/lovable`.
 *
 * Google OAuth is intentionally unavailable in the SpaceFast preview — the
 * preview uses email/password auth instead. `signInWithOAuth` returns the
 * same `{ redirected, error }` shape the original returns, with an error the
 * auth page surfaces on the Google button.
 */

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      _provider: string,
      _opts?: SignInOptions,
    ): Promise<{ redirected: false; error: Error }> => {
      return {
        redirected: false,
        error: new Error("Google sign-in is not available in the SpaceFast preview."),
      };
    },
  },
};
