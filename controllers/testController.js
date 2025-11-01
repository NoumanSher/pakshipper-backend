export const mainServerRunnig = (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Server Connected</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f4a 50%, #2d3561 100%);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            overflow: hidden;
          }
          
          .server-container {
            text-align: center;
            animation: fadeInUp 1s ease-out;
          }
          
          .server-icon {
            width: 120px;
            height: 120px;
            margin-bottom: 30px;
            animation: pulse 2s infinite;
          }
          
          .status-text {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 15px;
            text-shadow: 0 4px 20px rgba(255, 255, 255, 0.3);
            background: linear-gradient(45deg, #64ffda, #00e676, #40c4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .subtitle {
            font-size: 1.2rem;
            color: #b0bec5;
            margin-bottom: 30px;
            opacity: 0.9;
          }
          
          .status-indicator {
            display: inline-flex;
            align-items: center;
            background: rgba(76, 175, 80, 0.2);
            border: 2px solid #4caf50;
            border-radius: 25px;
            padding: 10px 20px;
            margin-top: 20px;
          }
          
          .status-dot {
            width: 12px;
            height: 12px;
            background: #4caf50;
            border-radius: 50%;
            margin-right: 10px;
            animation: blink 1.5s infinite;
          }
          
          .particles {
            position: absolute;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: -1;
          }
          
          .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(100, 255, 218, 0.6);
            border-radius: 50%;
            animation: float 6s infinite linear;
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(50px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
          
          @keyframes blink {
            0%, 50% {
              opacity: 1;
            }
            51%, 100% {
              opacity: 0.3;
            }
          }
          
          @keyframes float {
            from {
              transform: translateY(100vh) rotate(0deg);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            to {
              transform: translateY(-100vh) rotate(360deg);
              opacity: 0;
            }
          }
          
          @media (max-width: 768px) {
            .status-text {
              font-size: 2rem;
            }
            .server-icon {
              width: 80px;
              height: 80px;
            }
          }
        </style>
      </head>
      <body>
        <div class="particles">
          <div class="particle" style="left: 10%; animation-delay: 0s;"></div>
          <div class="particle" style="left: 20%; animation-delay: 1s;"></div>
          <div class="particle" style="left: 30%; animation-delay: 2s;"></div>
          <div class="particle" style="left: 40%; animation-delay: 3s;"></div>
          <div class="particle" style="left: 50%; animation-delay: 4s;"></div>
          <div class="particle" style="left: 60%; animation-delay: 5s;"></div>
          <div class="particle" style="left: 70%; animation-delay: 2.5s;"></div>
          <div class="particle" style="left: 80%; animation-delay: 1.5s;"></div>
          <div class="particle" style="left: 90%; animation-delay: 3.5s;"></div>
        </div>
        
        <div class="server-container">
          <svg class="server-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="20" height="4" rx="1" fill="#64ffda" opacity="0.8"/>
            <rect x="2" y="10" width="20" height="4" rx="1" fill="#00e676" opacity="0.8"/>
            <rect x="2" y="17" width="20" height="4" rx="1" fill="#40c4ff" opacity="0.8"/>
            <circle cx="6" cy="5" r="1" fill="#0a0e27"/>
            <circle cx="9" cy="5" r="1" fill="#0a0e27"/>
            <circle cx="6" cy="12" r="1" fill="#0a0e27"/>
            <circle cx="9" cy="12" r="1" fill="#0a0e27"/>
            <circle cx="6" cy="19" r="1" fill="#0a0e27"/>
            <circle cx="9" cy="19" r="1" fill="#0a0e27"/>
            <rect x="16" y="4" width="4" height="2" rx="0.5" fill="#0a0e27"/>
            <rect x="16" y="11" width="4" height="2" rx="0.5" fill="#0a0e27"/>
            <rect x="16" y="18" width="4" height="2" rx="0.5" fill="#0a0e27"/>
          </svg>
          
          <h1 class="status-text">Server Running</h1>
          <p class="subtitle">System Online & Ready</p>
          
          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Connected</span>
          </div>
        </div>
      </body>
    </html>
  `);
};
