DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>AI Router Dashboard | Stratic Soft</title>

    <script src="https://cdn.tailwindcss.com"></script>

    <link rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <style>

        /* =========================================================
           STRATIC SOFT — PREMIUM ENTERPRISE UI
           Design only. Existing functionality preserved.
        ========================================================= */

        * {
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            margin: 0;
            font-family:
                Inter,
                ui-sans-serif,
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                sans-serif;

            background:
                radial-gradient(circle at 15% 10%, rgba(37, 99, 235, 0.14), transparent 28%),
                radial-gradient(circle at 85% 15%, rgba(124, 58, 237, 0.12), transparent 28%),
                radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.08), transparent 32%),
                #f4f7fb;

            color: #172033;
            min-height: 100vh;
        }

        /* =========================================================
           OPENING SCREEN
        ========================================================= */

        #openingScreen {
            position: fixed;
            inset: 0;
            z-index: 99999;

            display: flex;
            align-items: center;
            justify-content: center;

            background:
                radial-gradient(circle at center, rgba(37, 99, 235, 0.18), transparent 32%),
                linear-gradient(135deg, #07111f, #0b1728 50%, #101b31);

            transition:
                opacity 0.8s ease,
                visibility 0.8s ease;
        }

        #openingScreen.hide {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        .opening-content {
            text-align: center;
            animation: openingEnter 1s ease forwards;
        }

        .opening-logo {
            width: 92px;
            height: 92px;

            margin: 0 auto 22px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 26px;

            color: white;
            font-size: 42px;
            font-weight: 900;

            background:
                linear-gradient(135deg, #2563eb, #4f46e5 55%, #7c3aed);

            box-shadow:
                0 0 0 1px rgba(255,255,255,0.12),
                0 20px 60px rgba(37,99,235,0.40);

            animation: logoPulse 2.2s ease-in-out infinite;
        }

        .opening-title {
            color: white;
            font-size: 30px;
            font-weight: 800;
            letter-spacing: -0.8px;
        }

        .opening-subtitle {
            margin-top: 7px;
            color: #94a3b8;
            font-size: 13px;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        .opening-line {
            width: 150px;
            height: 3px;

            margin: 25px auto 0;

            border-radius: 999px;

            background: linear-gradient(
                90deg,
                transparent,
                #3b82f6,
                #8b5cf6,
                transparent
            );

            animation: lineMove 1.6s ease-in-out infinite;
        }

        @keyframes openingEnter {
            from {
                opacity: 0;
                transform: translateY(25px) scale(0.96);
            }

            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes logoPulse {
            0%, 100% {
                transform: scale(1);
                box-shadow:
                    0 0 0 1px rgba(255,255,255,0.12),
                    0 20px 60px rgba(37,99,235,0.35);
            }

            50% {
                transform: scale(1.045);
                box-shadow:
                    0 0 0 1px rgba(255,255,255,0.15),
                    0 24px 80px rgba(79,70,229,0.48);
            }
        }

        @keyframes lineMove {
            0%, 100% {
                opacity: 0.35;
                transform: scaleX(0.75);
            }

            50% {
                opacity: 1;
                transform: scaleX(1);
            }
        }

        /* =========================================================
           MAIN APPLICATION
        ========================================================= */

        .app-shell {
            width: 100%;
            max-width: 1180px;
            margin: 0 auto;
            padding: 26px 18px 55px;
        }

        .main-panel {
            position: relative;
            overflow: hidden;

            background: rgba(255,255,255,0.92);

            border: 1px solid rgba(148,163,184,0.22);

            border-radius: 28px;

            box-shadow:
                0 25px 70px rgba(15,23,42,0.10),
                0 4px 14px rgba(15,23,42,0.05);

            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
        }

        .main-panel::before {
            content: "";
            position: absolute;

            width: 420px;
            height: 420px;

            right: -220px;
            top: -220px;

            border-radius: 50%;

            background:
                radial-gradient(
                    circle,
                    rgba(59,130,246,0.09),
                    transparent 70%
                );

            pointer-events: none;
        }

        .main-panel::after {
            content: "";
            position: absolute;

            width: 320px;
            height: 320px;

            left: -180px;
            bottom: -180px;

            border-radius: 50%;

            background:
                radial-gradient(
                    circle,
                    rgba(124,58,237,0.07),
                    transparent 70%
                );

            pointer-events: none;
        }

        .content-layer {
            position: relative;
            z-index: 2;
        }

        /* =========================================================
           TOP HEADER
        ========================================================= */

        .top-header {
            overflow: visible;
            padding: 28px 30px 24px;

            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 20px;

            border-bottom: 1px solid #e8edf5;
        }

        .brand-area {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .brand-logo {
            width: 52px;
            height: 52px;

            flex-shrink: 0;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 15px;

            color: white;
            font-size: 22px;
            font-weight: 900;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #4f46e5 55%,
                    #7c3aed
                );

            box-shadow:
                0 10px 25px rgba(37,99,235,0.22);
        }

        .brand-text h1 {
            margin: 0;

            color: #111827;

            font-size: 22px;
            line-height: 1.2;
            font-weight: 800;

            letter-spacing: -0.5px;
        }

        .brand-text p {
            margin: 5px 0 0;

            color: #64748b;

            font-size: 12px;
            font-weight: 600;

            letter-spacing: 0.8px;
        }

        .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 7px;

            padding: 8px 12px;

            border-radius: 999px;

            background: #f0f7ff;
            border: 1px solid #dbeafe;

            color: #2563eb;

            font-size: 11px;
            font-weight: 800;
        }

        .status-dot {
            width: 7px;
            height: 7px;

            border-radius: 50%;

            background: #22c55e;

            box-shadow: 0 0 0 4px rgba(34,197,94,0.10);
        }

        /* =========================================================
           ADD API BUTTON
        ========================================================= */

        .add-api-btn {
            border: none;
            cursor: pointer;

            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;

            padding: 12px 18px;

            border-radius: 13px;

            color: white;

            font-size: 13px;
            font-weight: 800;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #4f46e5
                );

            box-shadow:
                0 10px 25px rgba(37,99,235,0.20);

            transition:
                transform 0.2s ease,
                box-shadow 0.2s ease,
                filter 0.2s ease;
        }

        .add-api-btn:hover {
            transform: translateY(-2px);

            filter: brightness(1.04);

            box-shadow:
                0 14px 30px rgba(37,99,235,0.28);
        }

        .add-api-btn:active {
            transform: translateY(0);
        }

        /* =========================================================
           SECTION
        ========================================================= */

        .section {
            padding: 25px 30px;
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 10px;

            margin-bottom: 15px;
        }

        .section-title-icon {
            width: 34px;
            height: 34px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 10px;

            color: #2563eb;

            background: #eff6ff;
            border: 1px solid #dbeafe;

            font-size: 14px;
        }

        .section-title h2,
        .section-title h3 {
            margin: 0;

            color: #172033;

            font-size: 15px;
            font-weight: 800;
        }

        .section-description {
            margin: -7px 0 18px 44px;

            color: #718096;

            font-size: 12px;
        }

        /* =========================================================
           PROVIDER FORM
        ========================================================= */

        #providerForm {
            margin: 0 30px 25px;
            padding: 23px;

            border-radius: 20px;

            background:
                linear-gradient(
                    145deg,
                    #f8fbff,
                    #f4f7ff
                );

            border: 1px solid #dce7f7;

            box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.9),
                0 12px 30px rgba(15,23,42,0.05);
        }

        .form-heading {
            display: flex;
            align-items: center;
            gap: 10px;

            margin-bottom: 18px;
        }

        .form-heading i {
            color: #2563eb;
        }

        .form-heading h2 {
            margin: 0;

            color: #172033;

            font-size: 15px;
            font-weight: 800;
        }

        .premium-input {
            width: 100%;

            min-height: 45px;

            padding: 0 14px;

            border-radius: 11px;

            outline: none;

            color: #172033;

            background: white;

            border: 1px solid #dbe3ee;

            font-size: 13px;

            box-shadow:
                0 2px 7px rgba(15,23,42,0.025);

            transition:
                border-color 0.2s ease,
                box-shadow 0.2s ease,
                transform 0.2s ease;
        }

        .premium-input::placeholder {
            color: #94a3b8;
        }

        .premium-input:focus {
            border-color: #60a5fa;

            box-shadow:
                0 0 0 4px rgba(59,130,246,0.10);

            transform: translateY(-1px);
        }

        .done-btn {
            border: none;
            cursor: pointer;

            padding: 11px 20px;

            border-radius: 11px;

            color: white;

            background:
                linear-gradient(
                    135deg,
                    #059669,
                    #10b981
                );

            font-size: 13px;
            font-weight: 800;

            box-shadow:
                0 8px 18px rgba(16,185,129,0.18);

            transition: all 0.2s ease;
        }

        .done-btn:hover {
            transform: translateY(-2px);

            box-shadow:
                0 12px 23px rgba(16,185,129,0.25);
        }

        /* =========================================================
           PROVIDER LIST
        ========================================================= */

        .provider-list-wrap {
            padding: 0 30px 24px;
        }

        #providersList {
            min-height: 43px;

            padding: 12px;

            display: flex;
            flex-wrap: wrap;
            gap: 8px;

            border-radius: 15px;

            background: #f8fafc;

            border: 1px solid #e6ebf2;
        }

        .provider-chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;

            padding: 8px 11px;

            border-radius: 10px;

            color: #2563eb;

            background: white;

            border: 1px solid #dbeafe;

            font-size: 11px;
            font-weight: 700;

            box-shadow:
                0 3px 8px rgba(15,23,42,0.04);
        }

        /* =========================================================
           ROUTING SECTION
        ========================================================= */

        .routing-section {
            padding: 25px 30px 30px;

            border-top: 1px solid #e8edf5;
        }

        .routing-heading {
            display: flex;
            align-items: center;
            gap: 10px;

            margin-bottom: 19px;
        }

        .routing-heading-icon {
            width: 36px;
            height: 36px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 11px;

            color: #7c3aed;

            background: #f5f3ff;
            border: 1px solid #e9d5ff;
        }

        .routing-heading h2 {
            margin: 0;

            color: #172033;

            font-size: 17px;
            font-weight: 850;
        }

        .routing-heading p {
            margin: 3px 0 0;

            color: #94a3b8;

            font-size: 11px;
        }

        .routing-grid {
            display: grid;

            grid-template-columns:
                repeat(3, minmax(0, 1fr));

            gap: 15px;
        }

        .routing-card {
            position: relative;

            overflow: hidden;

            padding: 20px;

            border-radius: 19px;

            background: white;

            border: 1px solid #e5eaf1;

            box-shadow:
                0 8px 22px rgba(15,23,42,0.045);

            transition:
                transform 0.22s ease,
                box-shadow 0.22s ease,
                border-color 0.22s ease;
        }

        .routing-card::before {
            content: "";

            position: absolute;

            top: 0;
            left: 0;
            right: 0;

            height: 3px;

            opacity: 0.9;
        }

        .routing-card.low::before {
            background: linear-gradient(90deg, #10b981, #34d399);
        }

        .routing-card.medium::before {
            background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }

        .routing-card.hard::before {
            background: linear-gradient(90deg, #ef4444, #fb7185);
        }

        .routing-card:hover {
            transform: translateY(-4px);

            box-shadow:
                0 16px 32px rgba(15,23,42,0.09);

            border-color: #cbd5e1;
        }

        .level-icon {
            width: 39px;
            height: 39px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 12px;

            margin-bottom: 13px;

            font-size: 14px;
        }

        .low .level-icon {
            color: #059669;
            background: #ecfdf5;
        }

        .medium .level-icon {
            color: #d97706;
            background: #fffbeb;
        }

        .hard .level-icon {
            color: #dc2626;
            background: #fef2f2;
        }

        .routing-card h3 {
            margin: 0;

            font-size: 15px;
            font-weight: 900;

            letter-spacing: 0.5px;
        }

        .low h3 {
            color: #059669;
        }

        .medium h3 {
            color: #d97706;
        }

        .hard h3 {
            color: #dc2626;
        }

        .routing-card p {
            margin: 5px 0 15px;

            color: #94a3b8;

            font-size: 11px;
        }

        .premium-select {
            width: 100%;

            height: 42px;

            padding: 0 11px;

            border-radius: 10px;

            color: #334155;

            background: #f8fafc;

            border: 1px solid #e2e8f0;

            outline: none;

            font-size: 12px;
            font-weight: 600;

            cursor: pointer;

            transition: all 0.2s ease;
        }

        .premium-select:focus {
            border-color: #93c5fd;

            background: white;

            box-shadow:
                0 0 0 4px rgba(59,130,246,0.08);
        }

        /* =========================================================
           PRODUCTION KEY
        ========================================================= */

        .production-section {
            margin: 0 30px 30px;
            padding: 24px;

            border-radius: 21px;

            background:
                linear-gradient(
                    135deg,
                    #101827,
                    #17223a 55%,
                    #202b48
                );

            border: 1px solid rgba(148,163,184,0.18);

            box-shadow:
                0 18px 40px rgba(15,23,42,0.16);

            color: white;
        }

        .production-title {
            display: flex;
            align-items: center;
            gap: 12px;

            margin-bottom: 17px;
        }

        .production-icon {
            width: 40px;
            height: 40px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 12px;

            color: #c4b5fd;

            background: rgba(139,92,246,0.14);

            border: 1px solid rgba(167,139,250,0.20);
        }

        .production-title h2 {
            margin: 0;

            color: white;

            font-size: 16px;
            font-weight: 850;
        }

        .production-title p {
            margin: 3px 0 0;

            color: #94a3b8;

            font-size: 11px;
        }

        .production-input {
            width: 100%;

            min-height: 45px;

            padding: 0 14px;

            color: white;

            background: rgba(255,255,255,0.06);

            border: 1px solid rgba(148,163,184,0.20);

            border-radius: 11px;

            outline: none;

            font-size: 13px;

            transition: all 0.2s ease;
        }

        .production-input::placeholder {
            color: #94a3b8;
        }

        .production-input:focus {
            border-color: rgba(96,165,250,0.65);

            background: rgba(255,255,255,0.08);

            box-shadow:
                0 0 0 4px rgba(59,130,246,0.10);
        }

        .generate-btn {
            min-height: 45px;

            padding: 0 20px;

            border: none;
            border-radius: 11px;

            color: white;

            background:
                linear-gradient(
                    135deg,
                    #7c3aed,
                    #4f46e5
                );

            font-size: 12px;
            font-weight: 850;

            cursor: pointer;

            box-shadow:
                0 10px 24px rgba(124,58,237,0.25);

            transition: all 0.2s ease;
        }

        .generate-btn:hover {
            transform: translateY(-2px);

            box-shadow:
                0 14px 30px rgba(124,58,237,0.34);

            filter: brightness(1.06);
        }

        #keyOutput {
            margin-top: 14px;

            padding: 14px 15px;

            border-radius: 12px;

            color: #86efac;

            background: rgba(0,0,0,0.22);

            border: 1px solid rgba(134,239,172,0.16);

            font-size: 12px;

            line-height: 1.7;

            word-break: break-all;
        }

        /* =========================================================
           FOOTER / BRAND
        ========================================================= */

        .brand-footer {
            padding: 3px 30px 27px;

            text-align: center;
        }

        .footer-brand {
            display: inline-flex;
            align-items: center;
            gap: 7px;

            color: #64748b;

            font-size: 11px;
            font-weight: 700;
        }

        .footer-brand-mark {
            width: 20px;
            height: 20px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 6px;

            color: white;

            background:
                linear-gradient(135deg, #2563eb, #7c3aed);

            font-size: 9px;
            font-weight: 900;
        }

        .footer-brand strong {
            color: #334155;
        }

        /* =========================================================
           LOADING STATE
        ========================================================= */

        .loading-dot {
            display: inline-block;

            width: 6px;
            height: 6px;

            margin-left: 5px;

            border-radius: 50%;

            background: currentColor;

            animation: loadingDot 1s infinite ease-in-out;
        }

        @keyframes loadingDot {
            0%, 80%, 100% {
                opacity: 0.25;
                transform: scale(0.7);
            }

            40% {
                opacity: 1;
                transform: scale(1);
            }
        }

        /* =========================================================
           MOBILE
        ========================================================= */

        @media (max-width: 800px) {

            .app-shell {
                padding: 12px 10px 35px;
            }

            .main-panel {
                border-radius: 20px;
            }

            .top-header {
            overflow: visible;
                padding: 20px 17px;

                align-items: flex-start;

                flex-direction: column;
            }

            .brand-area {
                width: 100%;
            }

            .brand-text h1 {
                font-size: 19px;
            }

            .add-api-btn {
                width: 100%;
            }

            .header-badge {
                display: none;
            }

            .section {
                padding: 20px 17px;
            }

            #providerForm {
                margin: 0 17px 20px;
                padding: 17px;
            }

            .provider-list-wrap {
                padding: 0 17px 20px;
            }

            .routing-section {
                padding: 20px 17px;
            }

            .routing-grid {
                grid-template-columns: 1fr;
            }

            .routing-card {
                padding: 18px;
            }

            .production-section {
                margin: 0 17px 22px;
                padding: 18px;
            }

            .brand-footer {
                padding: 0 17px 22px;
            }
        }

        @media (max-width: 430px) {

            .brand-logo {
                width: 46px;
                height: 46px;

                border-radius: 13px;
            }

            .brand-text h1 {
                font-size: 17px;
            }

            .brand-text p {
                font-size: 10px;
            }

            .opening-logo {
                width: 78px;
                height: 78px;

                font-size: 34px;

                border-radius: 22px;
            }

            .opening-title {
                font-size: 24px;
            }

            .production-section .flex {
                gap: 10px;
            }
        }

        /* =========================================================
           POPUP MESSAGE (alert) - premium dialog
        ========================================================= */

        .ui-dialog-overlay {
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(15, 23, 42, 0.55);
            -webkit-backdrop-filter: blur(6px);
            backdrop-filter: blur(6px);
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .ui-dialog-overlay.show { opacity: 1; }

        .ui-dialog {
            width: 100%;
            max-width: 380px;
            background: #ffffff;
            border-radius: 26px;
            padding: 28px 24px 22px;
            text-align: center;
            box-shadow:
                0 30px 80px rgba(15, 23, 42, 0.38),
                0 0 0 1px rgba(226, 232, 240, 0.9);
            transform: translateY(14px) scale(0.96);
            transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2);
        }

        .ui-dialog-overlay.show .ui-dialog { transform: none; }

        .ui-dialog-icon {
            width: 66px;
            height: 66px;
            margin: 0 auto 16px;
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 27px;
        }

        .ui-warn    { background: #fffbeb; color: #d97706; box-shadow: 0 10px 26px rgba(217, 119, 6, 0.22); }
        .ui-error   { background: #fef2f2; color: #dc2626; box-shadow: 0 10px 26px rgba(220, 38, 38, 0.22); }
        .ui-success { background: #ecfdf5; color: #059669; box-shadow: 0 10px 26px rgba(5, 150, 105, 0.22); }
        .ui-info    { background: #eff6ff; color: #2563eb; box-shadow: 0 10px 26px rgba(37, 99, 235, 0.22); }

        .ui-dialog-brand {
            font-size: 10.5px;
            font-weight: 800;
            letter-spacing: 0.16em;
            color: #94a3b8;
            margin-bottom: 6px;
        }

        .ui-dialog-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.3px;
            color: #172033;
            margin-bottom: 10px;
        }

        .ui-dialog-msg {
            font-size: 15px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 24px;
            word-break: break-word;
        }

        .ui-dialog-btn {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 15px;
            color: #ffffff;
            font-weight: 800;
            font-size: 15px;
            letter-spacing: 0.4px;
            cursor: pointer;
            background: linear-gradient(135deg, #1d4ed8, #4338ca 55%, #6d28d9);
            box-shadow: 0 12px 28px rgba(67, 56, 202, 0.45);
            transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
        }

        .ui-dialog-btn:hover { filter: brightness(1.1); }

        .ui-dialog-btn:active {
            filter: brightness(0.78);
            transform: scale(0.98);
            box-shadow: 0 5px 14px rgba(67, 56, 202, 0.4);
        }

    </style>
</head>

<body>

    <!-- =========================================================
         PREMIUM OPENING SCREEN
    ========================================================== -->

    <div id="openingScreen">

        <div class="opening-content">

            <div class="opening-logo">
                S
            </div>

            <div class="opening-title">
                Stratic Soft
            </div>

            <div class="opening-subtitle">
                AI Router Console
            </div>

            <div class="opening-line"></div>

        </div>

    </div>


    <!-- =========================================================
         MAIN APPLICATION
    ========================================================== -->

    <div class="app-shell">

        <div class="main-panel">

            <div class="content-layer">


                <!-- =================================================
                     HEADER
                ================================================== -->

                <div class="top-header">

                    <div class="brand-area">

                        <div class="brand-logo">
                            S
                        </div>

                        <div class="brand-text">

                            <h1>
                                AI Router Console
                            </h1>

                            <p>
                                STRATIC SOFT • AI INFRASTRUCTURE
                            </p>

                        </div>

                    </div>


                    <div class="flex items-center gap-3">

                        <!-- Profile (login ke baad user ke naam ka pehla akshar) -->
                        <div id="profileWrap" class="relative" style="overflow:visible;">
                            <button id="profileBtn" onclick="toggleProfileMenu(event)" aria-label="Profile"
                                    class="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-base shadow-md transition hover:brightness-110 active:scale-95"
                                    style="background:linear-gradient(135deg,#2563eb,#4f46e5 55%,#7c3aed);">
                                <span id="profileInitial"></span>
                            </button>

                            <div id="profileMenu" class="hidden absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" style="z-index:9999;">
                                <div class="px-4 py-3.5 border-b border-slate-100">
                                    <div id="profileName" class="text-sm font-bold text-slate-800 truncate"></div>
                                    <div id="profileEmail" class="text-xs text-slate-400 truncate"></div>
                                </div>
                                <button onclick="logoutUser()" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 flex items-center gap-3 text-sm font-semibold text-slate-700">
                                    <i class="fa-solid fa-right-from-bracket text-red-500 w-5 text-center"></i>
                                    Log out
                                </button>
                            </div>
                        </div>

                        <div class="header-badge">
                            <span class="status-dot"></span>
                            System Ready
                        </div>

                        <!-- Three Dot History Menu -->
                        <div class="relative" style="overflow:visible;">
                            <button onclick="toggleHistoryMenu(event)" class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition shadow-sm">
                                <i class="fa-solid fa-ellipsis-vertical text-slate-600 text-lg"></i>
                            </button>

                            <div id="historyMenu" class="hidden absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" style="min-width:220px; z-index:9999;">
                                <button onclick="openApiKeysHistory()" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                                    <i class="fa-solid fa-key text-blue-500 w-5 text-center"></i>
                                    API Keys History
                                </button>
                                <button onclick="openProductionHistory()" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700 border-t border-slate-100">
                                    <i class="fa-solid fa-building text-purple-500 w-5 text-center"></i>
                                    Production Keys History
                                </button>
                                <button onclick="openUsageDashboard()" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700 border-t border-slate-100">
                                    <i class="fa-solid fa-chart-line text-emerald-500 w-5 text-center"></i>
                                    Dashboard
                                </button>
                                <button onclick="openRecharge()" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700 border-t border-slate-100">
                                    <i class="fa-solid fa-bolt text-amber-500 w-5 text-center"></i>
                                    Recharge
                                    <span id="menuDays" class="ml-auto hidden text-[11px] font-bold px-2 py-0.5 rounded-full"></span>
                                </button>
                                <button onclick="openAssistant()" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700 border-t border-slate-100">
                                    <i class="fa-solid fa-robot text-indigo-500 w-5 text-center"></i>
                                    AI Assistant
                                </button>
                                <button onclick="openGuide()" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700 border-t border-slate-100">
                                    <i class="fa-solid fa-code text-sky-500 w-5 text-center"></i>
                                    API Guide
                                </button>
                            </div>
                        </div>

                        <button
                            onclick="toggleProviderForm()"
                            class="add-api-btn">

                            <i class="fa-solid fa-plus"></i>

                            Add API Key

                        </button>

                    </div>

                </div>


                <!-- =================================================
                     PROVIDER FORM
                ================================================== -->

                <div id="providerForm" class="hidden">

                    <div class="form-heading">

                        <i class="fa-solid fa-plug-circle-plus"></i>

                        <h2>
                            Add & Verify Provider
                        </h2>

                    </div>


                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <input
                            id="name"
                            placeholder="Provider Name (e.g. Groq, OpenAI)"
                            class="premium-input">


                        <input
                            id="api_key"
                            type="password"
                            placeholder="Enter Your API Key"
                            class="premium-input">


                        <input
                            id="model_name"
                            placeholder="Enter Your Model (e.g. gpt-4o, llama-3.3-70b)"
                            class="premium-input">


                        <input
                            id="base_url"
                            placeholder="Enter Your URL"
                            value="https://api.openai.com/v1"
                            class="premium-input">

                    </div>


                    <div class="mt-5 flex items-center gap-4">

                        <button
                            onclick="verifyAndSaveProvider()"
                            class="done-btn">

                            <i class="fa-solid fa-check mr-1"></i>

                            Done

                        </button>

                        <div
                            id="checkResult"
                            class="text-sm font-bold">
                        </div>

                    </div>

                </div>


                <!-- =================================================
                     SAVED API KEYS
                ================================================== -->

                <div class="provider-list-wrap">

                    <div class="section-title">

                        <div class="section-title-icon">
                            <i class="fa-solid fa-key"></i>
                        </div>

                        <h3>
                            Available API Keys
                        </h3>

                    </div>

                    <div id="providersList">

                        <span class="text-slate-400 text-xs">
                            Loading providers...
                        </span>

                    </div>

                </div>


                <!-- =================================================
                     ROUTING
                ================================================== -->

                <div class="routing-section">

                    <div class="routing-heading">

                        <div class="routing-heading-icon">
                            <i class="fa-solid fa-route"></i>
                        </div>

                        <div>

                            <h2>
                                Word Limit Mapping & Routing
                            </h2>

                            <p>
                                Configure intelligent model routing by response complexity
                            </p>

                        </div>

                    </div>


                    <div class="routing-grid">


                        <!-- LOW -->

                        <div class="routing-card low">

                            <div class="level-icon">
                                <i class="fa-solid fa-bolt"></i>
                            </div>

                            <h3>
                                LOW
                            </h3>

                            <p>
                                1 - 50 शब्द
                            </p>

                            <select
                                id="low_select"
                                class="premium-select">
                            </select>

                        </div>


                        <!-- MEDIUM -->

                        <div class="routing-card medium">

                            <div class="level-icon">
                                <i class="fa-solid fa-layer-group"></i>
                            </div>

                            <h3>
                                MEDIUM
                            </h3>

                            <p>
                                51 - 100 शब्द
                            </p>

                            <select
                                id="medium_select"
                                class="premium-select">
                            </select>

                        </div>


                        <!-- HARD -->

                        <div class="routing-card hard">

                            <div class="level-icon">
                                <i class="fa-solid fa-brain"></i>
                            </div>

                            <h3>
                                HARD
                            </h3>

                            <p>
                                101+ शब्द
                            </p>

                            <select
                                id="hard_select"
                                class="premium-select">
                            </select>

                        </div>

                    </div>

                </div>


                <!-- =================================================
                     PRODUCTION KEY
                ================================================== -->

                <div class="production-section">

                    <div class="production-title">

                        <div class="production-icon">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>

                        <div>

                            <h2>
                                Generate Production Key
                            </h2>

                            <p>
                                Create a secure production access key for your company
                            </p>

                        </div>

                    </div>


                    <div class="flex flex-col md:flex-row gap-3 mb-4">

                        <input
                            id="company_name"
                            placeholder="Company Name"
                            class="production-input flex-1">


                        <button
                            onclick="generateProductionKey()"
                            class="generate-btn">

                            <i class="fa-solid fa-key mr-2"></i>

                            Generate Production Key

                        </button>

                    </div>


                    <div
                        id="keyOutput"
                        class="hidden font-mono break-all">
                    </div>

                </div>


                <!-- =================================================
                     STRATIC SOFT FOOTER
                ================================================== -->

                <div class="brand-footer">

                    <div class="footer-brand">

                        <span class="footer-brand-mark">
                            S
                        </span>

                        Powered by
                        <strong>
                            Stratic Soft
                        </strong>

                    </div>

                </div>


            </div>

        </div>

    </div>


    <!-- =========================================================
         HISTORY MODALS
    ========================================================== -->

    <!-- API Keys History Modal -->
    <div id="apiKeysModal" class="fixed inset-0 bg-black/40 z-[9999] hidden items-center justify-center p-4" style="display:none;">
        <div class="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 class="font-bold text-lg text-slate-800">API Keys History</h3>
                <button onclick="closeApiKeysHistory()" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
                    <i class="fa-solid fa-xmark text-slate-500"></i>
                </button>
            </div>
            <div id="apiKeysList" class="p-4 overflow-y-auto max-h-[60vh] space-y-2">
            </div>
        </div>
    </div>

    <!-- Production Keys History Modal -->
    <div id="productionModal" class="fixed inset-0 bg-black/40 z-[9999] hidden items-center justify-center p-4" style="display:none;">
        <div class="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 class="font-bold text-lg text-slate-800">Production Keys History</h3>
                <button onclick="closeProductionHistory()" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
                    <i class="fa-solid fa-xmark text-slate-500"></i>
                </button>
            </div>
            <div id="productionList" class="p-4 overflow-y-auto max-h-[60vh] space-y-2">
            </div>
        </div>
    </div>



    <!-- AI Assistant Modal -->
    <div id="aiModal" class="fixed inset-0 bg-black/40 z-[9999] hidden items-center justify-center p-4" style="display:none;">
        <div class="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col" style="height:min(86vh,720px);">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                    <h3 class="font-bold text-base text-slate-800">AI Assistant</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Test your Production Key right here</p>
                </div>
                <button onclick="closeAssistant()" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
                    <i class="fa-solid fa-xmark text-slate-500"></i>
                </button>
            </div>
            <div id="aiBody" class="flex-1 min-h-0 flex flex-col"></div>
        </div>
    </div>

    <!-- API Guide Modal -->
    <div id="guideModal" class="fixed inset-0 bg-black/40 z-[9999] hidden items-center justify-center p-4" style="display:none;">
        <div class="bg-white rounded-3xl w-full max-w-lg max-h-[88vh] overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                    <h3 class="font-bold text-base text-slate-800">API Guide</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Connect the router to your own app</p>
                </div>
                <button onclick="closeGuide()" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
                    <i class="fa-solid fa-xmark text-slate-500"></i>
                </button>
            </div>
            <div id="guideBody" class="p-5 overflow-y-auto max-h-[75vh]"></div>
        </div>
    </div>

    <!-- Recharge Modal -->
    <div id="rechargeModal" class="fixed inset-0 bg-black/40 z-[9999] hidden items-center justify-center p-4" style="display:none;">
        <div class="bg-white rounded-3xl w-full max-w-lg max-h-[88vh] overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                    <h3 class="font-bold text-base text-slate-800">Recharge</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Your plan, validity and top-ups</p>
                </div>
                <button onclick="closeRecharge()" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
                    <i class="fa-solid fa-xmark text-slate-500"></i>
                </button>
            </div>
            <div id="rechargeBody" class="p-5 overflow-y-auto max-h-[75vh]">
                <div class="text-center text-slate-400 py-8 text-sm">Loading...</div>
            </div>
        </div>
    </div>

    <!-- Usage Dashboard Modal -->
    <div id="usageDashboardModal" class="fixed inset-0 bg-black/40 z-[9999] hidden items-center justify-center p-4" style="display:none;">
        <div class="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                    <h3 class="font-bold text-base text-slate-800">API Usage Map</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Real request tracking per API key</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="loadUsageDashboard()" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center" title="Refresh">
                        <i class="fa-solid fa-rotate-right text-slate-500"></i>
                    </button>
                    <button onclick="closeUsageDashboard()" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
                        <i class="fa-solid fa-xmark text-slate-500"></i>
                    </button>
                </div>
            </div>
            <div class="p-5 overflow-y-auto max-h-[72vh]">
                <div id="planSummary" class="mb-5"></div>
                <div class="grid grid-cols-3 gap-3 mb-6">
                    <div class="rounded-2xl bg-blue-50 border border-blue-100 p-3.5 text-center">
                        <div class="text-xl font-black text-blue-600" id="statTotalReq">0</div>
                        <div class="text-[11px] font-semibold text-blue-400 mt-1">Total Requests</div>
                    </div>
                    <div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 text-center">
                        <div class="text-xl font-black text-emerald-600" id="statTotalOk">0</div>
                        <div class="text-[11px] font-semibold text-emerald-400 mt-1">Total Success</div>
                    </div>
                    <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-center">
                        <div class="text-xl font-black text-slate-500" id="statTotalFail">0</div>
                        <div class="text-[11px] font-semibold text-slate-400 mt-1">Total Failed</div>
                    </div>
                </div>
                <div id="providerStatsList" class="space-y-5">
                    <div class="text-center text-slate-400 py-8 text-sm">Loading...</div>
                </div>
            </div>
        </div>
    </div>

                <!-- Top provider -->
                <div id="topProviderBox" class="mb-5 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 p-4 hidden">
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Most Used Today</div>
                    <div class="font-bold text-slate-800 mt-1" id="topProviderName">—</div>
                    <div class="text-xs text-slate-500" id="topProviderCount"></div>
                </div>

                <!-- Per API table -->
                <div class="mb-2 text-sm font-bold text-slate-700">Per API Key</div>
                <div id="providerStatsList" class="space-y-2 mb-5">
                    <div class="text-center text-slate-400 py-6 text-sm">Loading...</div>
                </div>

                <!-- Simple bar chart today by hour -->
                <div class="mb-2 text-sm font-bold text-slate-700">Today — Hourly Chart</div>
                <div id="hourlyChart" class="rounded-2xl border border-slate-100 bg-slate-50 p-4 overflow-x-auto">
                    <div class="text-center text-slate-400 text-sm py-4">No data yet</div>
                </div>
            </div>
        </div>
    </div>

    <!-- =========================================================
         JAVASCRIPT
         EXISTING FUNCTIONALITY PRESERVED
    ========================================================== -->

    <script>

        /* =========================================================
           OPENING SCREEN
        ========================================================= */

        // Force hide opening screen - multiple fallbacks so it always disappears
        
        /* ===== POPUP MESSAGE (alert) - sundar dialog ===== */
        (function () {
            var queue = [];
            var isOpen = false;

            function classify(msg) {
                var m = String(msg).toLowerCase();
                if (/(fail|error|not found|invalid|समस्या|विफल|गलत)/.test(m)) {
                    return { cls: 'ui-error', icon: 'fa-circle-xmark', title: 'Error' };
                }
                if (/(success|saved|copied|सफल)/.test(m)) {
                    return { cls: 'ui-success', icon: 'fa-circle-check', title: 'Success' };
                }
                if (/(कृपया|please|select|choose|चुनें|भरें)/.test(m)) {
                    return { cls: 'ui-warn', icon: 'fa-triangle-exclamation', title: 'Attention' };
                }
                return { cls: 'ui-info', icon: 'fa-circle-info', title: 'Notice' };
            }

            function showNext() {
                if (isOpen || !queue.length) return;
                isOpen = true;

                var msg = queue.shift();
                var kind = classify(msg);
                var closed = false;

                var overlay = document.createElement('div');
                overlay.className = 'ui-dialog-overlay';
                overlay.innerHTML =
                    '<div class="ui-dialog" role="alertdialog" aria-modal="true">' +
                        '<div class="ui-dialog-icon ' + kind.cls + '"><i class="fa-solid ' + kind.icon + '"></i></div>' +
                        '<div class="ui-dialog-brand">STRATIC SOFT • AI ROUTER</div>' +
                        '<div class="ui-dialog-title"></div>' +
                        '<div class="ui-dialog-msg"></div>' +
                        '<button type="button" class="ui-dialog-btn">OK</button>' +
                    '</div>';

                overlay.querySelector('.ui-dialog-title').textContent = kind.title;
                overlay.querySelector('.ui-dialog-msg').textContent = msg;
                document.body.appendChild(overlay);

                var btn = overlay.querySelector('.ui-dialog-btn');

                function onKey(e) {
                    if (e.key === 'Escape' || e.key === 'Enter') {
                        e.preventDefault();
                        close();
                    }
                }

                function close() {
                    if (closed) return;
                    closed = true;
                    document.removeEventListener('keydown', onKey);
                    overlay.classList.remove('show');
                    setTimeout(function () {
                        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                        isOpen = false;
                        showNext();
                    }, 200);
                }

                btn.addEventListener('click', close);
                document.addEventListener('keydown', onKey);

                requestAnimationFrame(function () {
                    overlay.classList.add('show');
                    btn.focus();
                });
            }

            window.alert = function (message) {
                queue.push(String(message === undefined || message === null ? '' : message));
                showNext();
            };
        })();

        /* ===== LOGIN / PROFILE ===== */
        (function () {
            // Session khatam ho jaye to login page par wapas bhejo
            var originalFetch = window.fetch;
            window.fetch = function () {
                var args = arguments;
                return originalFetch.apply(this, args).then(function (res) {
                    try {
                        var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                        if (res.status === 401 && url.indexOf('/admin') !== -1) {
                            window.location.reload();
                        }
                    } catch (e) {}
                    return res;
                });
            };
        })();

        function toggleProfileMenu(event) {
            if (event) event.stopPropagation();
            var hm = document.getElementById('historyMenu');
            if (hm) hm.classList.add('hidden');
            document.getElementById('profileMenu').classList.toggle('hidden');
        }

        document.addEventListener('click', function (e) {
            var menu = document.getElementById('profileMenu');
            if (menu && !e.target.closest('#profileWrap')) {
                menu.classList.add('hidden');
            }
        });

        async function loadProfile() {
            try {
                var res = await fetch('/auth/me');
                if (!res.ok) return;
                var d = await res.json();
                var label = (d.name || d.email || '').trim();
                var first = Array.from(label)[0] || '';
                document.getElementById('profileInitial').textContent = first.toUpperCase();
                document.getElementById('profileName').textContent = d.name || '';
                document.getElementById('profileEmail').textContent = d.email || '';
            } catch (e) {}
        }

        async function logoutUser() {
            try {
                await fetch('/auth/logout', { method: 'POST' });
            } catch (e) {}
            window.location.href = '/';
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadProfile);
        } else {
            loadProfile();
        }

        /* ===== SILENT PER-DEVICE HISTORY ISOLATION ===== */
        function getClientId() {
            var id = localStorage.getItem('router_client_id');
            if (!id) {
                id = 'cid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
                localStorage.setItem('router_client_id', id);
            }
            return id;
        }
        function clientHeaders() {
            return {
                'Content-Type': 'application/json',
                'X-Client-Id': getClientId()
            };
        }

        function hideOpeningScreen() {
            var screen = document.getElementById("openingScreen");
            if (screen) {
                screen.classList.add("hide");
                screen.style.display = "none";
                screen.style.visibility = "hidden";
                screen.style.opacity = "0";
                screen.style.pointerEvents = "none";
                screen.style.zIndex = "-1";
            }
        }
        // Run at several timings so one of them will catch
        setTimeout(hideOpeningScreen, 800);
        setTimeout(hideOpeningScreen, 1500);
        setTimeout(hideOpeningScreen, 2500);
        if (document.readyState === "complete") {
            setTimeout(hideOpeningScreen, 400);
        } else {
            window.addEventListener("load", function() {
                setTimeout(hideOpeningScreen, 400);
            });
        }
        document.addEventListener("DOMContentLoaded", function() {
            setTimeout(hideOpeningScreen, 300);
        });


        /* =========================================================
           PROVIDER FORM
        ========================================================= */

        function toggleProviderForm() {
            var form = document.getElementById('providerForm');
            form.classList.toggle('hidden');

            // Form open hone par pehle se bhare hue fields clear kar do
            // taaki naya API key seedha type kar saken (mobile pe cut-paste na karna pade)
            if (!form.classList.contains('hidden')) {
                document.getElementById('name').value = '';
                document.getElementById('api_key').value = '';
                document.getElementById('model_name').value = '';
                document.getElementById('base_url').value = 'https://api.openai.com/v1';
                var checkResult = document.getElementById('checkResult');
                if (checkResult) {
                    checkResult.innerHTML = '';
                    checkResult.className = 'text-sm font-bold flex items-center gap-2';
                }
            }
        }


        /* =========================================================
           VERIFY & SAVE PROVIDER
        ========================================================= */

        async function verifyAndSaveProvider() {

            const checkResult =
                document.getElementById('checkResult');

            checkResult.className =
                "text-sm font-bold text-yellow-600 flex items-center gap-2";

            checkResult.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Checking credentials...';


            const data = {

                name:
                    document.getElementById('name').value,

                api_key:
                    document.getElementById('api_key').value,

                base_url:
                    document.getElementById('base_url').value,

                model_name:
                    document.getElementById('model_name').value

            };


            try {

                const res = await fetch(
                    '/admin/providers/verify-and-add',
                    {
                        method: 'POST',

                        headers: clientHeaders(),
                        body: JSON.stringify(data)
                    }
                );


                const result =
                    await res.json();


                if (res.ok && result.valid) {

                    checkResult.className =
                        "text-sm font-bold text-green-600 flex items-center gap-1";

                    checkResult.innerHTML =
                        '<i class="fa-solid fa-circle-check"></i> Yes (Verified & Saved)';

                    loadProviders();

                } else {

                    checkResult.className =
                        "text-sm font-bold text-red-600";

                    checkResult.innerText =
                        "❌ Invalid Credentials";

                }

            } catch (error) {

                checkResult.className =
                    "text-sm font-bold text-red-600";

                checkResult.innerText =
                    "❌ Connection Error";

            }

        }


        /* =========================================================
           HISTORY MENU + DELETE SYSTEM
        ========================================================== */

        function toggleHistoryMenu(event) {
            if (event) event.stopPropagation();
            const menu = document.getElementById('historyMenu');
            menu.classList.toggle('hidden');
        }

        document.addEventListener('click', function(e) {
            const menu = document.getElementById('historyMenu');
            if (menu && !e.target.closest('.relative')) {
                menu.classList.add('hidden');
            }
            // close item menus
            document.querySelectorAll('[id^="api-menu-"], [id^="prod-menu-"]').forEach(el => {
                if (!e.target.closest('[id^="api-menu-"]') && !e.target.closest('[id^="prod-menu-"]') && !e.target.closest('button')) {
                    el.classList.add('hidden');
                }
            });
        });

        function openApiKeysHistory() {
            document.getElementById('historyMenu').classList.add('hidden');
            const modal = document.getElementById('apiKeysModal');
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
            loadApiKeysHistory();
        }

        function closeApiKeysHistory() {
            const modal = document.getElementById('apiKeysModal');
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }

        async function loadApiKeysHistory() {
            const list = document.getElementById('apiKeysList');
            list.innerHTML = '<div class="text-center text-slate-400 py-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';

            try {
                const res = await fetch('/admin/providers', { headers: clientHeaders() });
                const providers = await res.json();

                if (!providers || providers.length === 0) {
                    list.innerHTML = '<p class="text-center text-slate-400 py-10 text-sm">No API Keys found</p>';
                    return;
                }

                list.innerHTML = providers.map(p => `
                    <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 transition group">
                        <div class="flex-1 min-w-0 pr-3">
                            <div class="font-semibold text-slate-800 truncate">${p.name || 'Unnamed'}</div>
                            <div class="text-xs text-slate-500 truncate mt-0.5">${p.model_name || ''}</div>
                        </div>
                        <div class="relative">
                            <button onclick="toggleItemMenu(event, 'api-menu-${p.id}')" class="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-500">
                                <i class="fa-solid fa-ellipsis-vertical"></i>
                            </button>
                            <div id="api-menu-${p.id}" class="hidden absolute right-0 top-9 w-36 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden">
                                <button onclick="deleteApiKey(${p.id})" class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                                    <i class="fa-solid fa-trash text-xs"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } catch (err) {
                list.innerHTML = '<p class="text-center text-red-500 py-10 text-sm">Failed to load API Keys</p>';
            }
        }

        async function deleteApiKey(id) {
            if (!confirm('Delete this API Key? This cannot be undone.')) return;

            try {
                const res = await fetch('/admin/providers/' + id, { method: 'DELETE', headers: clientHeaders() });
                if (res.ok) {
                    loadApiKeysHistory();
                    if (typeof loadProviders === 'function') loadProviders();
                    if (typeof loadUsageDashboard === 'function') loadUsageDashboard();
                } else {
                    alert('Delete failed. Please try again.');
                }
            } catch (e) {
                alert('Error while deleting API Key');
            }
        }

        function openProductionHistory() {
            document.getElementById('historyMenu').classList.add('hidden');
            const modal = document.getElementById('productionModal');
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
            loadProductionHistory();
        }

        function closeProductionHistory() {
            const modal = document.getElementById('productionModal');
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }

        async function loadProductionHistory() {
            const list = document.getElementById('productionList');
            list.innerHTML = '<div class="text-center text-slate-400 py-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';

            try {
                const res = await fetch('/admin/product-keys', { headers: clientHeaders() });
                const keys = await res.json();

                window._prodKeysFull = {};
                (keys || []).forEach(k => { window._prodKeysFull[k.id] = k.key || ''; });

                if (!keys || keys.length === 0) {
                    list.innerHTML = '<p class="text-center text-slate-400 py-10 text-sm">No Production Keys found</p>';
                    return;
                }

                list.innerHTML = keys.map(k => `
                    <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 transition">
                        <div class="flex-1 min-w-0 pr-3">
                            <div class="font-semibold text-slate-800 truncate">${k.company_name || 'Unnamed Company'}</div>
                            <div class="text-xs text-slate-500 font-mono truncate mt-0.5">${(k.key || '').substring(0, 28)}...</div>
                        </div>
                        <div class="relative">
                            <button onclick="toggleItemMenu(event, 'prod-menu-${k.id}')" class="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-500">
                                <i class="fa-solid fa-ellipsis-vertical"></i>
                            </button>
                            <div id="prod-menu-${k.id}" class="hidden absolute right-0 top-9 w-36 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden">
                                <button onclick="deleteProductionKey(${k.id})" class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                                    <i class="fa-solid fa-trash text-xs"></i> Delete
                                </button>
                                <button onclick="copyProductionKey(event, ${k.id})" class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium border-t border-slate-100">
                                    <i class="fa-solid fa-copy text-xs"></i> <span>Copy</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('') + '<div style="height:70px"></div>';
            } catch (err) {
                list.innerHTML = '<p class="text-center text-red-500 py-10 text-sm">Failed to load Production Keys</p>';
            }
        }

        async function deleteProductionKey(id) {
            if (!confirm('Delete this Production Key? This cannot be undone.')) return;

            try {
                const res = await fetch('/admin/product-keys/' + id, { method: 'DELETE', headers: clientHeaders() });
                if (res.ok) {
                    loadProductionHistory();
                    if (typeof loadUsageDashboard === 'function') loadUsageDashboard();
                } else {
                    alert('Delete failed. Please try again.');
                }
            } catch (e) {
                alert('Error while deleting Production Key');
            }
        }

        function copyProductionKey(event, id) {
            event.stopPropagation();
            const btn = event.currentTarget;
            const label = btn.querySelector('span');
            const fullKey = (window._prodKeysFull && window._prodKeysFull[id]) || '';
            if (!fullKey) { alert('Key not found'); return; }

            function done(ok) {
                if (label) label.textContent = ok ? 'Copied!' : 'Copy failed';
                setTimeout(function () {
                    if (label) label.textContent = 'Copy';
                    const menu = document.getElementById('prod-menu-' + id);
                    if (menu) menu.classList.add('hidden');
                }, 900);
            }

            function fallbackCopy() {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = fullKey;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    ta.setSelectionRange(0, ta.value.length);
                    const ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                    done(ok);
                } catch (e) {
                    done(false);
                }
            }

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(fullKey).then(function () { done(true); }).catch(fallbackCopy);
            } else {
                fallbackCopy();
            }
        }

        function toggleItemMenu(event, id) {
            event.stopPropagation();
            document.querySelectorAll('[id^="api-menu-"], [id^="prod-menu-"]').forEach(el => {
                if (el.id !== id) el.classList.add('hidden');
            });
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden');
        }


        /* =========================================================
           LOAD PROVIDERS
        ========================================================== */


        /* ===== USAGE DASHBOARD (REAL TOTALS) ===== */
        function openUsageDashboard() {
            document.getElementById('historyMenu').classList.add('hidden');
            var modal = document.getElementById('usageDashboardModal');
            if (!modal) return;
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
            loadUsageDashboard();
        }
        function closeUsageDashboard() {
            var modal = document.getElementById('usageDashboardModal');
            if (!modal) return;
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
        /* ===== AI ASSISTANT + API GUIDE ===== */
        var _aiKeys = [], _aiSel = null, _aiBusy = false;
        var _aiExamples = [
            'Hello!',
            'Explain in two lines how a router chooses a model.',
            'Write a detailed step by step plan to launch a small online business, including costs, marketing, hiring and a 6 month timeline.'
        ];
        function _g(id) { return document.getElementById(id); }
        function _maskKey(k) { return k && k.length > 12 ? k.slice(0, 7) + '...' + k.slice(-4) : (k || ''); }
        function _aiKey() {
            for (var i = 0; i < _aiKeys.length; i++) { if (String(_aiKeys[i].id) === String(_aiSel)) return _aiKeys[i]; }
            return _aiKeys.length ? _aiKeys[0] : null;
        }
        async function _loadKeysList() {
            try {
                var r = await fetch('/admin/product-keys', { headers: clientHeaders(), cache: 'no-store' });
                if (!r.ok) return null;
                return await r.json();
            } catch (e) { return null; }
        }
        function _copyText(text, btn) {
            function done() {
                if (!btn) return;
                var old = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(function () { btn.textContent = old; }, 1500);
            }
            function fallback() {
                var ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); done(); } catch (e) {}
                document.body.removeChild(ta);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done).catch(fallback);
            } else { fallback(); }
        }

        async function openAssistant() {
            _g('historyMenu').classList.add('hidden');
            var m = _g('aiModal');
            m.style.display = 'flex';
            m.classList.remove('hidden');
            _g('aiBody').innerHTML = '<div class="m-auto text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i></div>';
            await renderAssistant();
        }
        function closeAssistant() {
            var m = _g('aiModal');
            m.style.display = 'none';
            m.classList.add('hidden');
        }
        function aiGoGenerate() {
            closeAssistant();
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        async function renderAssistant() {
            var keys = await _loadKeysList();
            var body = _g('aiBody');
            if (keys === null) {
                body.innerHTML = '<p class="m-auto text-center text-red-500 text-sm px-6">Could not load your Production Keys. Please try again.</p>';
                return;
            }
            _aiKeys = keys;
            if (!_aiKeys.length) {
                body.innerHTML =
                    '<div class="m-auto text-center px-8">' +
                    '<div class="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-4"><i class="fa-solid fa-key text-indigo-500 text-2xl"></i></div>' +
                    '<div class="font-extrabold text-slate-800 text-lg">Get a Production Key first</div>' +
                    '<p class="text-sm text-slate-500 mt-2">There is no Production Key yet. Generate one, then come back here to test it.</p>' +
                    '<button onclick="aiGoGenerate()" class="mt-5 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold">Generate Production Key</button>' +
                    '</div>';
                return;
            }
            if (String((_aiKey() || {}).id) !== String(_aiSel)) _aiSel = _aiKeys[0].id;
            var opts = _aiKeys.map(function (k) {
                return '<option value="' + _esc(k.id) + '"' + (String(k.id) === String(_aiSel) ? ' selected' : '') + '>' +
                    _esc(k.company_name || 'Production Key') + ' - ' + _esc(_maskKey(k.key)) + '</option>';
            }).join('');
            var chips = ['Say hello', 'Short question', 'Long question'].map(function (t, i) {
                return '<button onclick="aiSend(_aiExamples[' + i + '])" class="shrink-0 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">' + t + '</button>';
            }).join('');
            body.innerHTML =
                '<div class="px-4 pt-3 pb-3 border-b border-slate-100">' +
                '<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Production Key in use</div>' +
                '<select onchange="_aiSel=this.value" class="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none">' + opts + '</select>' +
                '</div>' +
                '<div id="aiLog" class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50"></div>' +
                '<div class="px-4 pt-2 flex gap-2 overflow-x-auto">' + chips + '</div>' +
                '<div class="px-4 pb-4 pt-2 flex items-end gap-2">' +
                '<textarea id="aiInput" rows="1" placeholder="Type your question..." onkeydown="aiKeyDown(event)" class="flex-1 resize-none text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 outline-none" style="max-height:110px"></textarea>' +
                '<button onclick="aiSend()" class="w-11 h-11 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><i class="fa-solid fa-paper-plane"></i></button>' +
                '</div>';
            _aiAdd('bot', _bubbleBot('Hi! Ask me anything. Your question goes through your own router using the selected Production Key. Below every answer you will see which level, API and model handled it.'));
        }
        function aiKeyDown(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(); }
        }
        function _aiAdd(role, html) {
            var log = _g('aiLog');
            if (!log) return null;
            var d = document.createElement('div');
            d.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';
            d.innerHTML = html;
            log.appendChild(d);
            log.scrollTop = log.scrollHeight;
            return d;
        }
        function _bubbleUser(t) {
            return '<div class="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 text-white text-sm px-4 py-2.5" style="white-space:pre-wrap;word-break:break-word">' + _esc(t) + '</div>';
        }
        function _bubbleBot(t, meta) {
            return '<div class="max-w-[92%]"><div class="rounded-2xl rounded-bl-md bg-white border border-slate-200 text-slate-800 text-sm px-4 py-2.5" style="white-space:pre-wrap;word-break:break-word">' + _esc(t) + '</div>' + (meta || '') + '</div>';
        }
        function _metaHtml(info, ms, model) {
            var cx = String(info.complexity || '').toUpperCase();
            var cls = cx === 'HARD' ? 'bg-red-50 text-red-600 border-red-200' : (cx === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200');
            function chip(label, val, c) {
                return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold ' + (c || 'bg-slate-50 text-slate-600 border-slate-200') + '"><span class="opacity-60">' + label + '</span>' + _esc(val) + '</span>';
            }
            var h = '<div class="flex flex-wrap gap-1.5 mt-2">';
            if (cx) h += chip('Level', cx, cls);
            if (info.provider) h += chip('API', info.provider);
            h += chip('Model', info.model || model || '-');
            if (cx === 'INSTANT') h += chip('API cost', 'none', 'bg-emerald-50 text-emerald-600 border-emerald-200');
            h += chip('Time', (ms / 1000).toFixed(1) + 's');
            return h + '</div>';
        }
        async function aiSend(prefill) {
            if (_aiBusy) return;
            var inp = _g('aiInput');
            var text = String(prefill != null ? prefill : (inp ? inp.value : '')).trim();
            if (!text) return;
            var key = _aiKey();
            if (!key) { renderAssistant(); return; }
            if (inp) inp.value = '';
            _aiAdd('user', _bubbleUser(text));
            var box = _aiAdd('bot', '<div class="rounded-2xl bg-white border border-slate-200 text-slate-400 text-sm px-4 py-2.5"><i class="fa-solid fa-spinner fa-spin"></i> Thinking...</div>');
            _aiBusy = true;
            var t0 = Date.now();
            var out;
            try {
                var r = await fetch('/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key.key },
                    body: JSON.stringify({ messages: [{ role: 'user', content: text }] })
                });
                var j = {};
                try { j = await r.json(); } catch (e) {}
                var ms = Date.now() - t0;
                if (r.ok && j.choices && j.choices[0]) {
                    out = _bubbleBot((j.choices[0].message || {}).content || '', _metaHtml(j.router || {}, ms, j.model));
                } else {
                    var msg;
                    if (r.status === 401) {
                        msg = 'This Production Key is no longer valid (it may have been deleted). Please generate a Production Key first.';
                        setTimeout(renderAssistant, 1800);
                    } else if (r.status === 402) {
                        msg = 'Your plan has ended. Please recharge to keep using the router.';
                    } else if (r.status === 429) {
                        msg = 'Too many requests. Please wait a minute and try again.';
                    } else {
                        msg = (typeof j.detail === 'string' && j.detail) ? j.detail : 'Something went wrong. Please try again.';
                    }
                    out = '<div class="max-w-[92%] rounded-2xl rounded-bl-md bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">' + _esc(msg) + '</div>';
                }
            } catch (e) {
                out = '<div class="max-w-[92%] rounded-2xl rounded-bl-md bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">Network error. Please check your connection.</div>';
            }
            if (box) box.innerHTML = out;
            _aiBusy = false;
            var log = _g('aiLog');
            if (log) log.scrollTop = log.scrollHeight;
        }

        var _guideTab = 'curl', _guideKeys = [], _guideSel = null;
        function _guideCode(tab, url, key) {
            var NL = String.fromCharCode(10);
            if (tab === 'python') {
                return ['import requests', '',
                    'r = requests.post(', '    "' + url + '",',
                    '    headers={"Authorization": "Bearer ' + key + '"},',
                    '    json={"messages": [{"role": "user", "content": "Hello"}]},', ')',
                    'print(r.json()["choices"][0]["message"]["content"])'].join(NL);
            }
            if (tab === 'js') {
                return ['const r = await fetch("' + url + '", {', '  method: "POST",',
                    '  headers: {', '    "Content-Type": "application/json",', '    "Authorization": "Bearer ' + key + '"', '  },',
                    '  body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] })', '});',
                    'const data = await r.json();', 'console.log(data.choices[0].message.content);'].join(NL);
            }
            var Q = String.fromCharCode(39);
            return "curl -X POST " + url + ' -H "Content-Type: application/json" -H "Authorization: Bearer ' + key + '" -d ' + Q + '{"messages":[{"role":"user","content":"Hello"}]}' + Q;
        }
        async function openGuide() {
            _g('historyMenu').classList.add('hidden');
            var m = _g('guideModal');
            m.style.display = 'flex';
            m.classList.remove('hidden');
            _g('guideBody').innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin"></i></div>';
            _guideKeys = (await _loadKeysList()) || [];
            _guideSel = _guideKeys.length ? _guideKeys[0].id : null;
            renderGuide();
        }
        function closeGuide() {
            var m = _g('guideModal');
            m.style.display = 'none';
            m.classList.add('hidden');
        }
        function setGuideTab(t) { _guideTab = t; renderGuide(); }
        function setGuideKey(v) { _guideSel = v; renderGuide(); }
        function copyGuide(btn) { _copyText(_g('guideCode').textContent, btn); }
        function copyGuideUrl(btn) { _copyText(location.origin + '/v1/chat/completions', btn); }
        function renderGuide() {
            var url = location.origin + '/v1/chat/completions';
            var key = 'YOUR_PRODUCTION_KEY';
            _guideKeys.forEach(function (k) { if (String(k.id) === String(_guideSel)) key = k.key; });
            var tabs = [['curl', 'cURL'], ['python', 'Python'], ['js', 'JavaScript']].map(function (t) {
                var on = _guideTab === t[0];
                return '<button onclick="setGuideTab(' + String.fromCharCode(39) + t[0] + String.fromCharCode(39) + ')" class="px-3.5 py-2 rounded-xl text-xs font-bold ' + (on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600') + '">' + t[1] + '</button>';
            }).join('');
            var keyBox = _guideKeys.length
                ? '<select onchange="setGuideKey(this.value)" class="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none">' +
                    _guideKeys.map(function (k) {
                        return '<option value="' + _esc(k.id) + '"' + (String(k.id) === String(_guideSel) ? ' selected' : '') + '>' + _esc(k.company_name || 'Production Key') + ' - ' + _esc(_maskKey(k.key)) + '</option>';
                    }).join('') + '</select>'
                : '<div class="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">Generate a Production Key and it will appear here automatically.</div>';
            _g('guideBody').innerHTML =
                '<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Endpoint</div>' +
                '<div class="flex items-center gap-2 mb-4"><div class="flex-1 min-w-0 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 truncate">POST ' + _esc(url) + '</div>' +
                '<button onclick="copyGuideUrl(this)" class="shrink-0 px-3 py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">Copy</button></div>' +
                '<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Production Key</div>' + keyBox +
                '<div class="flex gap-2 mt-4 mb-3">' + tabs + '</div>' +
                '<pre id="guideCode" class="text-[12px] leading-relaxed font-mono bg-slate-900 text-slate-100 rounded-2xl p-4 overflow-x-auto whitespace-pre-wrap" style="word-break:break-all">' + _esc(_guideCode(_guideTab, url, key)) + '</pre>' +
                '<button onclick="copyGuide(this)" class="mt-3 w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold">Copy code</button>' +
                '<div class="mt-4 rounded-2xl bg-indigo-50 border border-indigo-100 p-3.5 text-xs text-indigo-700">' +
                'The router automatically sends each question to the LOW, MEDIUM or HARD model you mapped, so simple questions cost less. The reply also tells you which API and model answered.</div>';
        }

        /* ===== RECHARGE / PLAN ===== */
        var _billing = null;
        function _esc(s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        }
        function _fmtDate(iso) {
            if (!iso) return '-';
            try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
            catch (e) { return '-'; }
        }
        async function fetchBilling() {
            try {
                var r = await fetch('/billing/status', { cache: 'no-store' });
                if (!r.ok) return null;
                _billing = await r.json();
                return _billing;
            } catch (e) { return null; }
        }
        function _planSummaryHtml(b) {
            var active = b.state === 'active';
            var left = active ? b.days_left : 0;
            var pill = active
                ? '<span class="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">Active</span>'
                : (b.state === 'expired'
                    ? '<span class="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold">Plan ended</span>'
                    : '<span class="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-bold">Not started</span>');
            var pct = active ? Math.min(100, Math.round(left * 100 / Math.max(b.cycle_days || 30, 1))) : 0;
            var bar = !active ? 'bg-red-400' : (left <= 5 ? 'bg-amber-400' : 'bg-emerald-500');
            var run = b.days_running == null ? '-' : (b.days_running === 0 ? 'Started today' : b.days_running + (b.days_running === 1 ? ' day' : ' days'));
            return (
                '<div class="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">' +
                '<div class="flex items-center justify-between">' +
                '<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Plan status</div>' + pill + '</div>' +
                '<div class="flex items-end gap-2 mt-2"><div class="text-4xl font-black text-slate-800 leading-none">' + _esc(left) + '</div>' +
                '<div class="text-sm font-semibold text-slate-400 pb-1">days left</div></div>' +
                '<div class="h-2 rounded-full bg-slate-100 mt-3 overflow-hidden"><div class="h-full rounded-full ' + bar + '" style="width:' + pct + '%"></div></div>' +
                '<div class="grid grid-cols-2 gap-3 mt-4">' +
                '<div class="rounded-xl bg-white border border-slate-100 p-3"><div class="text-[11px] font-semibold text-slate-400">Running for</div>' +
                '<div class="text-sm font-bold text-slate-800 mt-0.5">' + _esc(run) + '</div></div>' +
                '<div class="rounded-xl bg-white border border-slate-100 p-3"><div class="text-[11px] font-semibold text-slate-400">' + (active ? 'Valid until' : 'Ended on') + '</div>' +
                '<div class="text-sm font-bold text-slate-800 mt-0.5">' + _esc(_fmtDate(b.expires_at)) + '</div></div>' +
                '</div></div>'
            );
        }
        function _rechargeHtml(b) {
            var h = _planSummaryHtml(b);
            if (b.free_available) {
                h += '<div class="mt-4 rounded-2xl p-4 text-white" style="background:linear-gradient(135deg,#22c55e,#059669)">' +
                    '<div class="text-[11px] font-bold tracking-wide uppercase opacity-90">Special offer</div>' +
                    '<div class="text-lg font-black mt-0.5">First month FREE</div>' +
                    '<div class="text-xs opacity-90 mt-1">Get ' + _esc(b.free_days) + ' days free. No payment needed.</div>' +
                    '<button onclick="claimFree(this)" class="mt-3 w-full py-2.5 rounded-xl bg-white text-emerald-700 text-sm font-extrabold">Claim free month</button>' +
                    '<div id="freeErr" class="text-xs mt-2 text-white/90"></div></div>';
            }
            h += '<div class="mt-5 mb-2 text-sm font-bold text-slate-700">Add more days</div><div class="space-y-2.5">';
            (b.plans || []).forEach(function (p, i) {
                h += '<div class="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5">' +
                    '<div><div class="font-extrabold text-slate-800">' + _esc(p.days) + ' days</div>' +
                    '<div class="text-xs text-slate-400">Added to your current validity</div></div>' +
                    '<div class="flex items-center gap-3"><div class="font-black text-slate-800 text-lg">' + _esc(p.price) + '</div>' +
                    '<button onclick="showPayContact(' + i + ')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">Recharge</button></div></div>';
            });
            h += '</div><div id="rechargeContact" class="mt-4"></div>';
            return h;
        }
        function showPayContact(i) {
            var b = _billing || {};
            var p = (b.plans || [])[i];
            var box = document.getElementById('rechargeContact');
            if (!p || !box) return;
            var phone = b.contact_phone || '';
            box.innerHTML = '<div class="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-center">' +
                '<div class="text-xs font-semibold text-indigo-400">You selected</div>' +
                '<div class="font-black text-slate-800 text-lg">' + _esc(p.days) + ' days - ' + _esc(p.price) + '</div>' +
                (phone
                    ? '<div class="text-xs text-slate-500 mt-2">Call to complete your payment</div>' +
                      '<a href="tel:' + _esc(phone.replace(/[^0-9+]/g, '')) + '" class="inline-block mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-lg">' + _esc(phone) + '</a>'
                    : '<div class="text-xs text-slate-500 mt-2">Please contact the owner to complete your payment.</div>') +
                '</div>';
        }
        async function openRecharge() {
            document.getElementById('historyMenu').classList.add('hidden');
            var modal = document.getElementById('rechargeModal');
            if (!modal) return;
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
            var body = document.getElementById('rechargeBody');
            body.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin"></i></div>';
            var b = await fetchBilling();
            body.innerHTML = b ? _rechargeHtml(b) : '<p class="text-center text-red-500 py-8 text-sm">Could not load plan details</p>';
        }
        function closeRecharge() {
            var modal = document.getElementById('rechargeModal');
            if (!modal) return;
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
        async function claimFree(btn) {
            btn.disabled = true;
            btn.textContent = 'Please wait...';
            try {
                var r = await fetch('/billing/claim-free', { method: 'POST' });
                var j = await r.json();
                if (!r.ok) throw new Error(j.detail || 'Failed');
                _billing = j;
                document.getElementById('rechargeBody').innerHTML = _rechargeHtml(j);
                refreshMenuDays();
            } catch (e) {
                btn.disabled = false;
                btn.textContent = 'Claim free month';
                var er = document.getElementById('freeErr');
                if (er) er.textContent = e.message;
            }
        }
        async function loadPlanSummary() {
            var el = document.getElementById('planSummary');
            if (!el) return;
            var b = await fetchBilling();
            el.innerHTML = b ? _planSummaryHtml(b) : '';
        }
        async function refreshMenuDays() {
            var el = document.getElementById('menuDays');
            if (!el) return;
            var b = await fetchBilling();
            if (!b || b.state === 'noplan') { el.classList.add('hidden'); return; }
            el.classList.remove('hidden');
            if (b.state === 'active') {
                el.textContent = b.days_left + 'd left';
                el.className = 'ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ' + (b.days_left <= 5 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600');
            } else {
                el.textContent = 'Ended';
                el.className = 'ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600';
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', refreshMenuDays);
        } else {
            refreshMenuDays();
        }
        setInterval(refreshMenuDays, 60000);

        function _barPct(part, total) {
            if (!total || total <= 0) return 0;
            return Math.min(100, Math.round((part / total) * 100));
        }
        async function loadUsageDashboard() {
            var list = document.getElementById('providerStatsList');
            if (!list) return;
            loadPlanSummary();
            list.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin"></i></div>';
            try {
                var res = await fetch('/admin/usage-stats', { headers: clientHeaders() });
                if (!res.ok) throw new Error('stats failed');
                var data = await res.json();

                document.getElementById('statTotalReq').innerText = (data.totals.requests || 0).toLocaleString();
                document.getElementById('statTotalOk').innerText = (data.totals.success || 0).toLocaleString();
                document.getElementById('statTotalFail').innerText = (data.totals.failed || 0).toLocaleString();

                if (!data.providers || data.providers.length === 0) {
                    list.innerHTML = '<p class="text-center text-slate-400 py-8 text-sm">No API keys yet. Add keys and send requests.</p>';
                    return;
                }

                // Max requests for relative bar width across all APIs
                var maxReq = 1;
                data.providers.forEach(function(p) {
                    if (p.requests > maxReq) maxReq = p.requests;
                });

                list.innerHTML = data.providers.map(function(p, idx) {
                    var req = p.requests || 0;
                    var ok = p.success || 0;
                    var fail = p.failed || 0;
                    var reqW = _barPct(req, maxReq);
                    var okW = req > 0 ? _barPct(ok, req) : 0;
                    var failW = req > 0 ? _barPct(fail, req) : 0;
                    var label = p.name || ('API ' + (idx + 1));
                    var model = p.model_name ? '<div class="text-xs text-slate-400 mb-2 truncate">' + p.model_name + '</div>' : '';
                    var deletedBadge = (p.is_active === false)
                        ? '<div class="inline-flex items-center gap-1.5 mt-1 mb-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold"><i class="fa-solid fa-circle-check text-[10px]"></i> Deleted — this API key is no longer active</div>'
                        : '';
                    return (
                        '<div class="pb-1' + (p.is_active === false ? ' opacity-80' : '') + '">' +
                        '<div class="font-bold text-slate-800 text-[15px] mb-1">' + label + '</div>' +
                        model +
                        deletedBadge +
                        '<div class="flex items-center justify-between text-sm text-slate-600 mb-1">' +
                        '<span>Requests</span><span class="font-semibold text-slate-800">' + req.toLocaleString() + '</span></div>' +
                        '<div class="h-2 rounded-full bg-slate-100 mb-3 overflow-hidden">' +
                        '<div class="h-full rounded-full bg-blue-500" style="width:' + reqW + '%"></div></div>' +
                        '<div class="flex items-center justify-between text-sm text-slate-600 mb-1">' +
                        '<span>Success</span><span class="font-semibold text-slate-800">' + ok.toLocaleString() + '</span></div>' +
                        '<div class="h-2 rounded-full bg-slate-100 mb-3 overflow-hidden">' +
                        '<div class="h-full rounded-full bg-emerald-500" style="width:' + okW + '%"></div></div>' +
                        '<div class="flex items-center justify-between text-sm text-slate-600 mb-1">' +
                        '<span>Failed</span><span class="font-semibold text-slate-800">' + fail.toLocaleString() + '</span></div>' +
                        '<div class="h-2 rounded-full bg-slate-100 overflow-hidden">' +
                        '<div class="h-full rounded-full bg-slate-300" style="width:' + failW + '%"></div></div>' +
                        '</div>'
                    );
                }).join('');
            } catch (e) {
                console.error(e);
                list.innerHTML = '<p class="text-center text-red-500 py-8 text-sm">Failed to load stats</p>';
            }
        }

        async function loadProviders() {

            try {

                const res =
                    await fetch('/admin/providers', { headers: clientHeaders() });

                const data =
                    await res.json();


                let listHtml = '';

                let optionsHtml =
                    '<option value="">Select API Key</option>';


                data.forEach(p => {

                    listHtml += `
                        <span class="provider-chip">
                            <i class="fa-solid fa-circle-check text-emerald-500"></i>
                            ${p.name} (${p.model_name})
                        </span>
                    `;


                    optionsHtml += `
                        <option value="${p.id}">
                            ${p.name} - ${p.model_name}
                        </option>
                    `;

                });


                document.getElementById(
                    'providersList'
                ).innerHTML =
                    listHtml ||
                    "<span class='text-slate-400 text-xs'>No active providers</span>";


                document.getElementById(
                    'low_select'
                ).innerHTML =
                    optionsHtml;


                document.getElementById(
                    'medium_select'
                ).innerHTML =
                    optionsHtml;


                document.getElementById(
                    'hard_select'
                ).innerHTML =
                    optionsHtml;


            } catch (error) {

                document.getElementById(
                    'providersList'
                ).innerHTML =
                    "<span class='text-red-400 text-xs'>Unable to load providers</span>";

            }

        }


        /* =========================================================
           GENERATE PRODUCTION KEY
        ========================================================== */

        async function generateProductionKey() {

            const company =
                document.getElementById(
                    'company_name'
                ).value;


            const low =
                document.getElementById(
                    'low_select'
                ).value;


            const medium =
                document.getElementById(
                    'medium_select'
                ).value;


            const hard =
                document.getElementById(
                    'hard_select'
                ).value;


            if (
                !company ||
                !low ||
                !medium ||
                !hard
            ) {

                alert(
                    "कृपया कंपनी का नाम और तीनों लेवल्स के लिए API Keys चुनें!"
                );

                return;

            }


            const data = {

                company_name:
                    company,

                low_provider_id:
                    parseInt(low),

                medium_provider_id:
                    parseInt(medium),

                hard_provider_id:
                    parseInt(hard)

            };


            try {

                const res =
                    await fetch(
                        '/admin/product-key',
                        {
                            method: 'POST',

                            headers: clientHeaders(),
                            body: JSON.stringify(data)
                        }
                    );


                const result =
                    await res.json();


                const out =
                    document.getElementById(
                        'keyOutput'
                    );


                out.classList.remove(
                    'hidden'
                );


                out.innerText =
                    "Production Key: " +
                    result.product_key;


            } catch (error) {

                alert(
                    "Production Key generate करने में समस्या आई।"
                );

            }

        }


        /* =========================================================
           INITIAL LOAD
        ========================================================== */

        loadProviders();

    </script>

</body>
</html>
"""


LOGIN_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log in | Stratic Soft AI Router</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <style>
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

        body {
            margin: 0;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background:
                radial-gradient(circle at 15% 10%, rgba(37, 99, 235, 0.14), transparent 28%),
                radial-gradient(circle at 85% 15%, rgba(124, 58, 237, 0.12), transparent 28%),
                radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.08), transparent 32%),
                #f4f7fb;
            color: #172033;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }

        .login-card {
            width: 100%;
            max-width: 420px;
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid rgba(226, 232, 240, 0.9);
            border-radius: 28px;
            padding: 30px 22px 26px;
            box-shadow: 0 25px 70px rgba(15, 23, 42, 0.12);
        }

        .login-logo {
            width: 52px;
            height: 52px;
            flex-shrink: 0;
            border-radius: 17px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: 900;
            background: linear-gradient(135deg, #2563eb, #4f46e5 55%, #7c3aed);
            box-shadow: 0 12px 30px rgba(37, 99, 235, 0.35);
        }

        .field {
            width: 100%;
            padding: 14px 15px;
            border-radius: 14px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            font-size: 16px;
            color: #172033;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }

        .field::placeholder { color: #94a3b8; }

        .field:focus {
            border-color: #4f46e5;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
            background: #ffffff;
        }

        .pw-wrap { position: relative; }
        .pw-wrap .field { padding-right: 46px; }

        .pw-toggle {
            position: absolute;
            top: 0;
            right: 0;
            height: 100%;
            width: 46px;
            border: none;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
            font-size: 15px;
        }

        .pw-toggle:hover { color: #475569; }

        .primary-btn {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 14px;
            color: white;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            background: linear-gradient(135deg, #2563eb, #4f46e5 55%, #7c3aed);
            box-shadow: 0 10px 26px rgba(79, 70, 229, 0.32);
            transition: filter 0.15s, transform 0.1s, box-shadow 0.15s;
        }

        .primary-btn:hover { filter: brightness(1.08); }

        .primary-btn:active {
            filter: brightness(0.82);
            transform: scale(0.98);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.30);
        }

        .primary-btn:disabled {
            filter: brightness(0.9);
            cursor: not-allowed;
            transform: none;
        }

        .google-btn {
            width: 100%;
            padding: 13px;
            border-radius: 14px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            color: #334155;
            font-weight: 700;
            font-size: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            text-decoration: none;
            transition: background 0.15s, transform 0.1s, border-color 0.15s;
        }

        .google-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
        .google-btn:active { background: #e2e8f0; transform: scale(0.98); }

        .link-btn {
            border: none;
            background: transparent;
            color: #4f46e5;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 6px;
        }

        .link-btn:hover { color: #3730a3; text-decoration: underline; }
        .link-btn:active { color: #1e1b4b; }
        .link-btn:disabled { color: #94a3b8; cursor: not-allowed; text-decoration: none; }

        .divider {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
        }

        .divider::before, .divider::after {
            content: "";
            flex: 1;
            height: 1px;
            background: #e2e8f0;
        }

        .code-row {
            display: flex;
            gap: 8px;
            justify-content: space-between;
        }

        .code-box {
            width: 100%;
            min-width: 0;
            height: 54px;
            text-align: center;
            font-size: 22px;
            font-weight: 800;
            color: #172033;
            border-radius: 14px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }

        .code-box:focus {
            border-color: #4f46e5;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
            background: #ffffff;
        }

        .spinner {
            display: inline-block;
            width: 15px;
            height: 15px;
            margin-right: 8px;
            vertical-align: -2px;
            border: 2px solid rgba(255,255,255,0.45);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>

<body>
    <div class="login-card">

        <div class="flex items-center gap-3 mb-6">
            <div class="login-logo">S</div>
            <div>
                <div class="font-extrabold text-lg text-slate-800">AI Router Console</div>
                <div class="text-xs text-slate-400 font-semibold tracking-wide">STRATIC SOFT • AI INFRASTRUCTURE</div>
            </div>
        </div>

        <h1 id="formTitle" class="text-2xl font-extrabold text-slate-800 mb-1">Welcome back</h1>
        <p id="formSubtitle" class="text-sm text-slate-500 mb-5">Log in to your account to continue.</p>

        <div id="authError" class="hidden mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-semibold"></div>
        <div id="authInfo" class="hidden mb-4 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold"></div>

        <!-- ============ VIEW: LOGIN / SIGN UP ============ -->
        <div id="viewAuth">
            <a href="/auth/google/login" class="google-btn">
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
            </a>

            <div class="divider my-5">OR</div>

            <div class="space-y-3">
                <input id="nameInput" type="text" class="field hidden" placeholder="Your name" autocomplete="name" maxlength="40">
                <input id="emailInput" type="email" class="field" placeholder="Email address" autocomplete="email" inputmode="email" autocapitalize="none">
                <div class="pw-wrap">
                    <input id="passwordInput" type="password" class="field" placeholder="Password" autocomplete="current-password">
                    <button type="button" class="pw-toggle" onclick="togglePassword('passwordInput','pwIcon')" aria-label="Show or hide password">
                        <i id="pwIcon" class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <p id="pwHint" class="hidden text-xs text-slate-400 px-1">Use at least 8 characters.</p>
                <div id="forgotRow" class="text-right -mt-1">
                    <button type="button" class="link-btn" onclick="openForgot()">Forgot password?</button>
                </div>
                <button id="submitBtn" class="primary-btn" onclick="submitAuth()">Log in</button>
            </div>

            <p class="text-center text-sm text-slate-500 mt-5">
                <span id="switchText">Don't have an account?</span>
                <button id="switchBtn" class="link-btn" onclick="switchMode()">Sign up</button>
            </p>
        </div>

        <!-- ============ VIEW: FORGOT PASSWORD (email) ============ -->
        <div id="viewForgot" class="hidden">
            <div class="space-y-3">
                <input id="forgotEmail" type="email" class="field" placeholder="Email address" autocomplete="email" inputmode="email" autocapitalize="none">
                <button id="forgotBtn" class="primary-btn" onclick="sendResetCode()">Send verification code</button>
            </div>
            <p class="text-center text-sm text-slate-500 mt-5">
                <button class="link-btn" onclick="backToLogin()"><i class="fa-solid fa-arrow-left text-xs"></i> Back to log in</button>
            </p>
        </div>

        <!-- ============ VIEW: ENTER CODE ============ -->
        <div id="viewCode" class="hidden">
            <div class="code-row" id="codeRow">
                <input class="code-box" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit 1">
                <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2">
                <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3">
                <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4">
                <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5">
                <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6">
            </div>
            <div class="mt-4">
                <button id="verifyBtn" class="primary-btn" onclick="verifyCode()">Verify</button>
            </div>
            <p class="text-center text-sm text-slate-500 mt-5">
                Didn't get the code?
                <button id="resendBtn" class="link-btn" onclick="resendCode()">Resend code</button>
            </p>
            <p class="text-center text-sm text-slate-500 mt-1">
                <button class="link-btn" onclick="backToLogin()"><i class="fa-solid fa-arrow-left text-xs"></i> Back to log in</button>
            </p>
        </div>

        <!-- ============ VIEW: NEW PASSWORD ============ -->
        <div id="viewNewPass" class="hidden">
            <div class="space-y-3">
                <div class="pw-wrap">
                    <input id="newPassword" type="password" class="field" placeholder="New password" autocomplete="new-password">
                    <button type="button" class="pw-toggle" onclick="togglePassword('newPassword','newPwIcon')" aria-label="Show or hide password">
                        <i id="newPwIcon" class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <input id="confirmPassword" type="password" class="field" placeholder="Confirm new password" autocomplete="new-password">
                <p class="text-xs text-slate-400 px-1">Use at least 8 characters.</p>
                <button id="savePwBtn" class="primary-btn" onclick="saveNewPassword()">Save new password</button>
            </div>
        </div>
    </div>

    <script>
        var mode = 'login';          // 'login' ya 'signup'
        var view = 'auth';           // 'auth', 'forgot', 'code', 'newpass'
        var codePurpose = 'reset';   // 'signup' ya 'reset'
        var pendingEmail = '';
        var resetToken = '';
        var cooldown = 0;
        var cooldownTimer = null;

        function el(id) { return document.getElementById(id); }

        function showError(msg) {
            el('authInfo').classList.add('hidden');
            var box = el('authError');
            box.textContent = msg;
            box.classList.remove('hidden');
        }

        function showInfo(msg) {
            el('authError').classList.add('hidden');
            var box = el('authInfo');
            box.textContent = msg;
            box.classList.remove('hidden');
        }

        function clearMessages() {
            el('authError').classList.add('hidden');
            el('authInfo').classList.add('hidden');
        }

        function setLoading(btnId, loading, label) {
            var btn = el(btnId);
            btn.disabled = loading;
            if (loading) {
                btn.innerHTML = '<span class="spinner"></span>Please wait';
            } else {
                btn.textContent = label;
            }
        }

        function authLabel() {
            return mode === 'login' ? 'Log in' : 'Create account';
        }

        function showView(name) {
            view = name;
            clearMessages();
            el('viewAuth').classList.toggle('hidden', name !== 'auth');
            el('viewForgot').classList.toggle('hidden', name !== 'forgot');
            el('viewCode').classList.toggle('hidden', name !== 'code');
            el('viewNewPass').classList.toggle('hidden', name !== 'newpass');

            if (name === 'auth') {
                var isLogin = mode === 'login';
                el('formTitle').textContent = isLogin ? 'Welcome back' : 'Create your account';
                el('formSubtitle').textContent = isLogin
                    ? 'Log in to your account to continue.'
                    : 'Sign up to start routing your AI requests.';
            } else if (name === 'forgot') {
                el('formTitle').textContent = 'Reset your password';
                el('formSubtitle').textContent = 'Enter your email and we will send you a verification code.';
            } else if (name === 'code') {
                el('formTitle').textContent = 'Check your email';
                el('formSubtitle').textContent = 'We sent a 6-digit code to ' + pendingEmail + '. It expires in 10 minutes.';
            } else if (name === 'newpass') {
                el('formTitle').textContent = 'Create new password';
                el('formSubtitle').textContent = 'Choose a new password for your account.';
            }
        }

        function switchMode() {
            mode = mode === 'login' ? 'signup' : 'login';
            var isLogin = mode === 'login';
            el('nameInput').classList.toggle('hidden', isLogin);
            el('pwHint').classList.toggle('hidden', isLogin);
            el('forgotRow').classList.toggle('hidden', !isLogin);
            el('switchText').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
            el('switchBtn').textContent = isLogin ? 'Sign up' : 'Log in';
            el('passwordInput').setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
            setLoading('submitBtn', false, authLabel());
            showView('auth');
        }

        function togglePassword(inputId, iconId) {
            var input = el(inputId);
            var icon = el(iconId);
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        }

        function backToLogin() {
            if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
            mode = 'login';
            el('nameInput').classList.add('hidden');
            el('pwHint').classList.add('hidden');
            el('forgotRow').classList.remove('hidden');
            el('switchText').textContent = "Don't have an account?";
            el('switchBtn').textContent = 'Sign up';
            setLoading('submitBtn', false, 'Log in');
            showView('auth');
        }

        function openForgot() {
            el('forgotEmail').value = el('emailInput').value.trim();
            showView('forgot');
        }

        async function postJson(url, body) {
            var res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            var data = {};
            try { data = await res.json(); } catch (e) {}
            return { ok: res.ok, status: res.status, data: data };
        }

        function errorText(r) {
            if (r.status === 429) {
                if (typeof r.data.detail === 'string') return r.data.detail;
                return 'Too many attempts. Please wait a minute and try again.';
            }
            if (typeof r.data.detail === 'string') return r.data.detail;
            if (r.status === 422) return 'Please check the details you entered.';
            return 'Something went wrong. Please try again.';
        }

        /* ---------------- LOGIN / SIGN UP ---------------- */
        async function submitAuth() {
            clearMessages();
            var name = el('nameInput').value.trim();
            var email = el('emailInput').value.trim();
            var password = el('passwordInput').value;

            if (mode === 'signup' && !name) { showError('Please enter your name.'); return; }
            if (!email || !password) { showError('Please enter your email and password.'); return; }

            setLoading('submitBtn', true, '');

            try {
                var r = mode === 'login'
                    ? await postJson('/auth/login', { email: email, password: password })
                    : await postJson('/auth/signup', { name: name, email: email, password: password });

                if (r.ok && r.data.verify) {
                    pendingEmail = r.data.email || email;
                    codePurpose = 'signup';
                    openCodeView();
                    setLoading('submitBtn', false, authLabel());
                    return;
                }
                if (r.ok) { window.location.href = '/'; return; }
                showError(errorText(r));
            } catch (e) {
                showError('Network problem. Please check your internet and try again.');
            }

            setLoading('submitBtn', false, authLabel());
        }

        /* ---------------- FORGOT PASSWORD ---------------- */
        async function sendResetCode() {
            clearMessages();
            var email = el('forgotEmail').value.trim();
            if (!email) { showError('Please enter your email address.'); return; }

            setLoading('forgotBtn', true, '');
            try {
                var r = await postJson('/auth/forgot', { email: email });
                if (r.ok) {
                    pendingEmail = email.toLowerCase();
                    codePurpose = 'reset';
                    openCodeView();
                } else {
                    showError(errorText(r));
                }
            } catch (e) {
                showError('Network problem. Please check your internet and try again.');
            }
            setLoading('forgotBtn', false, 'Send verification code');
        }

        /* ---------------- CODE ENTRY ---------------- */
        function codeBoxes() {
            return el('codeRow').querySelectorAll('.code-box');
        }

        function readCode() {
            var out = '';
            codeBoxes().forEach(function (b) { out += b.value; });
            return out;
        }

        function clearCode() {
            codeBoxes().forEach(function (b) { b.value = ''; });
        }

        function openCodeView() {
            clearCode();
            showView('code');
            startCooldown(60);
            var boxes = codeBoxes();
            if (boxes.length) boxes[0].focus();
        }

        function startCooldown(seconds) {
            cooldown = seconds;
            if (cooldownTimer) clearInterval(cooldownTimer);
            renderCooldown();
            cooldownTimer = setInterval(function () {
                cooldown -= 1;
                if (cooldown <= 0) {
                    clearInterval(cooldownTimer);
                    cooldownTimer = null;
                    cooldown = 0;
                }
                renderCooldown();
            }, 1000);
        }

        function renderCooldown() {
            var btn = el('resendBtn');
            if (cooldown > 0) {
                btn.disabled = true;
                btn.textContent = 'Resend in ' + cooldown + 's';
            } else {
                btn.disabled = false;
                btn.textContent = 'Resend code';
            }
        }

        function setupCodeBoxes() {
            var boxes = codeBoxes();
            boxes.forEach(function (box, i) {
                box.addEventListener('input', function () {
                    box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
                    if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
                    if (readCode().length === boxes.length) verifyCode();
                });
                box.addEventListener('keydown', function (e) {
                    if (e.key === 'Backspace' && !box.value && i > 0) {
                        boxes[i - 1].focus();
                        boxes[i - 1].value = '';
                    }
                });
                box.addEventListener('paste', function (e) {
                    var text = (e.clipboardData || window.clipboardData).getData('text') || '';
                    var digits = text.replace(/[^0-9]/g, '').slice(0, boxes.length);
                    if (!digits) return;
                    e.preventDefault();
                    for (var k = 0; k < boxes.length; k++) {
                        boxes[k].value = digits[k] || '';
                    }
                    var next = Math.min(digits.length, boxes.length - 1);
                    boxes[next].focus();
                    if (digits.length === boxes.length) verifyCode();
                });
            });
        }

        async function verifyCode() {
            clearMessages();
            var code = readCode();
            if (code.length !== 6) { showError('Please enter the 6-digit code.'); return; }

            setLoading('verifyBtn', true, '');
            try {
                var url = codePurpose === 'signup' ? '/auth/signup/verify' : '/auth/forgot/verify';
                var r = await postJson(url, { email: pendingEmail, code: code });

                if (r.ok && codePurpose === 'signup') { window.location.href = '/'; return; }
                if (r.ok) {
                    resetToken = r.data.reset_token || '';
                    el('newPassword').value = '';
                    el('confirmPassword').value = '';
                    showView('newpass');
                    el('newPassword').focus();
                } else {
                    showError(errorText(r));
                    clearCode();
                    var boxes = codeBoxes();
                    if (boxes.length) boxes[0].focus();
                }
            } catch (e) {
                showError('Network problem. Please check your internet and try again.');
            }
            setLoading('verifyBtn', false, 'Verify');
        }

        async function resendCode() {
            if (cooldown > 0) return;
            clearMessages();
            try {
                var url = codePurpose === 'signup' ? '/auth/signup/resend' : '/auth/forgot';
                var r = await postJson(url, { email: pendingEmail });
                if (r.ok) {
                    clearCode();
                    startCooldown(60);
                    showInfo('A new code has been sent to your email.');
                    var boxes = codeBoxes();
                    if (boxes.length) boxes[0].focus();
                } else {
                    showError(errorText(r));
                }
            } catch (e) {
                showError('Network problem. Please check your internet and try again.');
            }
        }

        /* ---------------- NEW PASSWORD ---------------- */
        async function saveNewPassword() {
            clearMessages();
            var pw = el('newPassword').value;
            var pw2 = el('confirmPassword').value;

            if (pw.length < 8) { showError('Password must be at least 8 characters.'); return; }
            if (pw !== pw2) { showError('Passwords do not match.'); return; }

            setLoading('savePwBtn', true, '');
            try {
                var r = await postJson('/auth/forgot/reset', {
                    email: pendingEmail,
                    reset_token: resetToken,
                    new_password: pw
                });
                if (r.ok) { window.location.href = '/'; return; }
                showError(errorText(r));
            } catch (e) {
                showError('Network problem. Please check your internet and try again.');
            }
            setLoading('savePwBtn', false, 'Save new password');
        }

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            if (view === 'auth') submitAuth();
            else if (view === 'forgot') sendResetCode();
            else if (view === 'code') verifyCode();
            else if (view === 'newpass') saveNewPassword();
        });

        setupCodeBoxes();

        (function showUrlError() {
            var err = new URLSearchParams(window.location.search).get('error');
            if (err === 'google_failed') showError('Google sign-in did not work. Please try again.');
            if (err === 'google_cancelled') showError('Google sign-in was cancelled.');
            if (err === 'google_not_configured') showError('Google sign-in is not set up yet.');
        })();
    </script>
</body>
</html>
"""
