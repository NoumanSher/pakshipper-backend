import asyncHandler from "../middlewares/asyncHandler.js";
import validator from "validator";

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribe an email address to the newsletter
 * @access  Public
 */
export const subscribeNewsletter = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ message: "Please provide a valid email address" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const { Newsletter } = req.models;

  // Check if email already subscribed
  let subscriber = await Newsletter.findOne({ email: cleanEmail });

  if (subscriber) {
    if (subscriber.status === "unsubscribed") {
      subscriber.status = "subscribed";
      await subscriber.save();
    }
    return res.status(200).json({
      message: "Thank you for subscribing!",
      data: subscriber,
    });
  }

  // Create new subscription
  subscriber = await Newsletter.create({
    email: cleanEmail,
    status: "subscribed",
  });

  res.status(201).json({
    message: "Subscription successful!",
    data: subscriber,
  });
});

/**
 * @route   GET /api/newsletter/subscribers
 * @desc    Get all newsletter subscribers
 * @access  Private/Admin
 */
export const getSubscribers = asyncHandler(async (req, res) => {
  const { Newsletter } = req.models;
  const subscribers = await Newsletter.find().sort({ createdAt: -1 });

  res.status(200).json({
    count: subscribers.length,
    data: subscribers,
  });
});

/**
 * @route   DELETE /api/newsletter/subscribers/:id
 * @desc    Delete a newsletter subscriber
 * @access  Private/Admin
 */
export const deleteSubscriber = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { Newsletter } = req.models;

  const subscriber = await Newsletter.findByIdAndDelete(id);

  if (!subscriber) {
    return res.status(404).json({ message: "Subscriber not found" });
  }

  res.status(200).json({ message: "Subscriber removed successfully" });
});
