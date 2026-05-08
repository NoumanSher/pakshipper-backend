import PostOrder from "../../models/post-order.js";
import Product from "../../models/products.js";
import User from "../../models/user-schema.js";
import Review from "../../models/Review.js";

export const getDashboardStats = async (req, res) => {
    try {
        // 1. Time-based filters (Last 30 days for trends)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 2. Aggregate Promises for performance
        const [
            ordersStats,
            productStats,
            userStats,
            reviewStats,
            recentOrders,
            recentReviews,
            dailyTrends
        ] = await Promise.all([
            // A. Financials & Order status breakdown
            PostOrder.aggregate([
                {
                    $addFields: {
                        latestStatusObj: { $arrayElemAt: ["$orderStatuses", -1] }
                    }
                },
                {
                    $facet: {
                        revenue: [
                            { $match: { "latestStatusObj.status": "Delivered" } },
                            { $group: { _id: null, totalRevenue: { $sum: "$total" }, count: { $sum: 1 } } }
                        ],
                        statusBreakdown: [
                            { $group: { _id: "$latestStatusObj.status", count: { $sum: 1 } } }
                        ],
                        totalOrders: [{ $count: "count" }]
                    }
                }
            ]),

            // B. Product Inventory Stats
            Product.aggregate([
                {
                    $facet: {
                        totalProducts: [{ $count: "count" }],
                        outOfStock: [
                            { $match: { stock: 0 } },
                            { $count: "count" }
                        ],
                        lowStock: [
                            { $match: { stock: { $gt: 0, $lte: 5 } } },
                            { $count: "count" }
                        ]
                    }
                }
            ]),

            // C. User stats
            User.aggregate([
                {
                    $facet: {
                        totalCustomers: [
                            { $match: { role: "user" } },
                            { $count: "count" }
                        ],
                        newCustomers30d: [
                            { $match: { role: "user", createdAt: { $gte: thirtyDaysAgo } } },
                            { $count: "count" }
                        ]
                    }
                }
            ]),

            // D. Review Stats
            Review.aggregate([
                {
                    $facet: {
                        totalReviews: [{ $count: "count" }],
                        pendingReviews: [
                            { $match: { status: "pending" } },
                            { $count: "count" }
                        ],
                        averageRating: [
                            { $group: { _id: null, avg: { $avg: "$rating" } } }
                        ]
                    }
                }
            ]),

            // E. Recent Activity
            PostOrder.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate("userId", "username email")
                .select("orderNo total createdAt orderStatuses"),

            Review.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate("userId", "username")
                .populate("productId", "productName")
                .select("rating description createdAt status"),

            // F. Daily Trends (Revenue and Orders)
            PostOrder.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $addFields: {
                        latestStatusObj: { $arrayElemAt: ["$orderStatuses", -1] }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        revenue: { 
                            $sum: { 
                                $cond: [
                                    { $in: ["$latestStatusObj.status", ["Cancelled", "Returned", "Return Requested"]] }, 
                                    0, 
                                    "$total" 
                                ] 
                            } 
                        },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        // Format the results
        const dashboardData = {
            financials: {
                totalRevenue: ordersStats[0].revenue[0]?.totalRevenue || 0,
                averageOrderValue: ordersStats[0].revenue[0]?.totalRevenue / (ordersStats[0].revenue[0]?.count || 1) || 0,
                totalOrders: ordersStats[0].totalOrders[0]?.count || 0
            },
            orders: {
                processing: ordersStats[0].statusBreakdown.find(s => s._id === "Processing")?.count || 0,
                pending: ordersStats[0].statusBreakdown.find(s => s._id === "Pending")?.count || 0,
                shipped: ordersStats[0].statusBreakdown.find(s => s._id === "Shipped")?.count || 0,
                delivered: ordersStats[0].statusBreakdown.find(s => s._id === "Delivered")?.count || 0,
                cancelled: ordersStats[0].statusBreakdown.find(s => s._id === "Cancelled")?.count || 0,
                returned: ordersStats[0].statusBreakdown.find(s => s._id === "Returned")?.count || 0,
                returnRequested: ordersStats[0].statusBreakdown.find(s => s._id === "Return Requested")?.count || 0,
            },
            inventory: {
                totalProducts: productStats[0].totalProducts[0]?.count || 0,
                outOfStock: productStats[0].outOfStock[0]?.count || 0,
                lowStock: productStats[0].lowStock[0]?.count || 0,
            },
            customers: {
                total: userStats[0].totalCustomers[0]?.count || 0,
                newLast30Days: userStats[0].newCustomers30d[0]?.count || 0,
            },
            reviews: {
                total: reviewStats[0].totalReviews[0]?.count || 0,
                pending: reviewStats[0].pendingReviews[0]?.count || 0,
                averageRating: parseFloat((reviewStats[0].averageRating[0]?.avg || 0).toFixed(1)),
            },
            recentActivity: {
                orders: recentOrders,
                reviews: recentReviews
            },
            trends: dailyTrends.map(item => ({
                date: item._id,
                revenue: item.revenue,
                orders: item.orders
            }))
        };

        res.status(200).json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching dashboard statistics",
            error: error.message
        });
    }
};
