import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage.js";
import { User } from "../shared/schema.js";

import pgSession from "connect-pg-simple";
import { pool } from "./db.js";

export function setupAuth(app: Express) {
    const PgSession = pgSession(session);
    const sessionSettings: session.SessionOptions = {
        store: new PgSession({
            pool,
            tableName: 'session',
            createTableIfMissing: true // Safety net, though we added to schema
        }),
        secret: process.env.SESSION_SECRET || "yvy-orbital-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        }
    };

    // In serverless environments (Vercel) or Proxied Servers, we must trust all upstream proxies
    // so Passport matches the callback protocol (HTTPS) accurately. Otherwise Google rejects with invalid_grant.
    app.set("trust proxy", true);

    if (app.get("env") === "production") {
        sessionSettings.cookie!.secure = true; // serve secure cookies
        sessionSettings.cookie!.sameSite = 'none'; // Required for cross-origin if frontend/backend separated
    }

    app.use(session(sessionSettings));
    app.use(passport.initialize());
    app.use(passport.session());

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google Login will not work.");
    } else {
        passport.use(
            new GoogleStrategy(
                {
                    clientID: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    callbackURL: "/auth/google/callback",
                    proxy: true,
                },
                async (accessToken, refreshToken, profile, done) => {
                    try {
                        const googleId = profile.id;
                        const email = profile.emails?.[0].value;
                        const name = profile.displayName;
                        const avatarUrl = profile.photos?.[0].value;

                        if (!email) {
                            return done(new Error("No email found in Google profile"));
                        }

                        let user = await storage.getUserByGoogleId(googleId);

                        if (!user) {
                            user = await storage.createUser({
                                email,
                                googleId,
                                name,
                                avatarUrl,
                                receiveAlerts: true,
                            });
                        } else {
                            // Check if user should be admin based on env var
                            const isAdminEmail = email === process.env.ADMIN_EMAIL;
                            const shouldUpdateRole = isAdminEmail && user.role !== 'admin';

                            if (user.avatarUrl !== avatarUrl || user.name !== name || shouldUpdateRole) {
                                const updateData: any = { name, avatarUrl };
                                if (shouldUpdateRole) {
                                    updateData.role = 'admin';
                                }
                                user = await storage.updateUser(user.id, updateData);
                            }
                        }

                        return done(null, user);
                    } catch (err) {
                        return done(err as Error);
                    }
                }
            )
        );
    }

    passport.serializeUser((user, done) => {
        done(null, (user as User).id);
    });

    passport.deserializeUser(async (id: number, done) => {
        try {
            const user = await storage.getUser(id);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });

    // Auth Routes
    app.get(
        "/auth/google",
        passport.authenticate("google", { scope: ["profile", "email"] })
    );

    app.get(
        "/auth/google/callback",
        (req, res, next) => {
            passport.authenticate("google", (err: any, user: any, info: any) => {
                if (err) {
                    console.error("OAuth Error:", err);
                    // Instead of failing with 500 JSON, gracefully redirect to index so user can try again
                    return res.redirect("/?error=oauth_failed");
                }
                if (!user) {
                    return res.redirect("/?error=oauth_no_user");
                }
                req.logIn(user, (loginErr) => {
                    if (loginErr) {
                        console.error("Login Error:", loginErr);
                        return res.redirect("/?error=login_failed");
                    }
                    // Successful authentication, redirect home.
                    return res.redirect("/");
                });
            })(req, res, next);
        }
    );

    app.post("/api/logout", (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.sendStatus(200);
        });
    });

    app.get("/api/user", (req, res) => {
        if (req.isAuthenticated()) {
            res.json(req.user);
        } else {
            res.status(401).json({ message: "Not authenticated" });
        }
    });
}
