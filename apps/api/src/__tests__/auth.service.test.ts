import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../config/database.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    business: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { AuthService } from "../services/auth.service.js";
import { env } from "../config/env.js";

describe("AuthService Token Logic", () => {
  const userId = "test-user-123";

  it("should generate a valid access token verified by verifyToken", () => {
    // Generate access token
    const token = jwt.sign({ sub: userId, type: "access" }, env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const result = AuthService.verifyToken(token);
    expect(result.sub).toBe(userId);
  });

  it("should reject an access token if it has type refresh", () => {
    const wrongTypeToken = jwt.sign({ sub: userId, type: "refresh" }, env.JWT_SECRET, {
      expiresIn: "15m",
    });

    expect(() => AuthService.verifyToken(wrongTypeToken)).toThrow("Invalid or expired token");
  });

  it("should successfully refresh tokens with a valid 7-day refresh token", () => {
    const refreshToken = jwt.sign({ sub: userId, type: "refresh" }, env.REFRESH_TOKEN_SECRET, {
      expiresIn: "7d",
    });

    const refreshed = AuthService.refreshTokens(refreshToken);
    expect(refreshed.userId).toBe(userId);
    expect(typeof refreshed.accessToken).toBe("string");
    expect(typeof refreshed.refreshToken).toBe("string");

    // The newly issued access token must be verifiable by verifyToken
    const verified = AuthService.verifyToken(refreshed.accessToken);
    expect(verified.sub).toBe(userId);

    // The newly issued refresh token must have 7-day expiry and type refresh
    const decodedRefresh = jwt.decode(refreshed.refreshToken) as {
      sub: string;
      type: string;
      exp: number;
      iat: number;
    };
    expect(decodedRefresh.sub).toBe(userId);
    expect(decodedRefresh.type).toBe("refresh");
    // 7 days = 7 * 24 * 60 * 60 = 604800 seconds
    expect(decodedRefresh.exp - decodedRefresh.iat).toBe(604800);

    // The newly issued access token must have 15-min expiry
    const decodedAccess = jwt.decode(refreshed.accessToken) as {
      sub: string;
      type: string;
      exp: number;
      iat: number;
    };
    expect(decodedAccess.sub).toBe(userId);
    expect(decodedAccess.type).toBe("access");
    // 15 min = 15 * 60 = 900 seconds
    expect(decodedAccess.exp - decodedAccess.iat).toBe(900);
  });

  it("should throw when trying to refresh with an invalid or expired refresh token", () => {
    // Tampered token
    expect(() => AuthService.refreshTokens("invalid.token.here")).toThrow(
      "Invalid or expired refresh token"
    );

    // Expired token
    const expiredToken = jwt.sign({ sub: userId, type: "refresh" }, env.REFRESH_TOKEN_SECRET, {
      expiresIn: "-1s",
    });
    expect(() => AuthService.refreshTokens(expiredToken)).toThrow(
      "Invalid or expired refresh token"
    );

    // Token signed with wrong secret (e.g. JWT_SECRET instead of REFRESH_TOKEN_SECRET)
    const wrongSecretToken = jwt.sign({ sub: userId, type: "refresh" }, env.JWT_SECRET, {
      expiresIn: "7d",
    });
    expect(() => AuthService.refreshTokens(wrongSecretToken)).toThrow(
      "Invalid or expired refresh token"
    );
  });
});
