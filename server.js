const express =
  require("express");

const config =
  require("./src/config");

const {
  connectMongoDB
} = require(
  "./src/config/mongodb"
);

const tags = require('./src/routes/tags');
const queues = require('./src/routes/queues');
const groups = require('./src/routes/groups');
const teams = require('./src/routes/teams');
const whatsappNumbers = require('./src/routes/whatsappNumbers');
const quickReplies = require('./src/routes/quickReplies');
const templates = require('./src/routes/templates');

const { authMiddleware } = require('./src/middleware/middleware');

const cors = require('cors')

const app =
  express();


app.use(
  express.json()
);

app.use(cors());

const startServer =
  async () => {

    try {

      // =========================
      // CONNECT MONGODB
      // =========================

      await connectMongoDB();


      // =========================
      // START SERVER
      // =========================

      app.listen(

        config.PORT,

        () => {
          let message = `Admin Backend Service running on port ${config.PORT} 🚀`

          app.get(
            "/",
            (req, res) => {

              res.send(message);

            }
          );

        }

      );

      app.use(authMiddleware)

      // Paths match what the frontend's services/*Api.js files already
      // call, and what cloud_service / local_service call for number
      // resolution (via x-internal-key — see middleware/middleware.js).
      app.use(
        "/admin/tags",
        tags
      );

      app.use(
        "/admin/queues",
        queues
      );

      app.use(
        "/admin/groups",
        groups
      );

      app.use(
        "/admin/teams",
        teams
      );

      app.use(
        "/admin/channels/whatsapp/numbers",
        whatsappNumbers
      );

      app.use(
        "/admin/quick-replies",
        quickReplies
      );

      app.use(
        "/templates",
        templates
      );

      // Translates thrown errors (with an optional `statusCode`, `message`,
      // and `details`) into a proper JSON response instead of falling
      // through to Express's default HTML error page.
      app.use((err, req, res, next) => {
        console.error(err);
        res.status(err.statusCode || 500).json({
          success: false,
          message: err.message || 'Something went wrong',
          ...(err.details ? { details: err.details } : {}),
        });
      });

    } catch (error) {

      console.error(
        "Failed to start Admin Backend:",
        error
      );

      process.exit(1);

    }

  };


startServer();
