import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User } from "../shared/schema";

export function setupAuth(app: Express) {
    const sessionSettings: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || "yvy-orbital-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: {}
    };

    if (app.get("env") === "production") {
        app.set("trust proxy", 1); // trust first proxy
        sessionSettings.cookie!.secure = true; // serve secure cookies
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
                            if (user.avatarUrl !== avatarUrl || user.name !== name) {
                                user = await storage.updateUser(user.id, { name, avatarUrl });
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
        passport.authenticate("google", { failureRedirect: "/login" }),
        (req, res) => {
            // Successful authentication, redirect home.
            res.redirect("/");
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
