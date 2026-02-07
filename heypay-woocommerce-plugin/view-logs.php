<?php
/**
 * HeyPay Debug Logs Viewer
 *
 * Place this file in your WordPress root directory
 * Access it via: https://yoursite.com/view-logs.php
 *
 * SECURITY: Delete this file after debugging!
 */

// Security check - change this password!
define('DEBUG_PASSWORD', 'heypay2024');

if (!isset($_GET['pwd']) || $_GET['pwd'] !== DEBUG_PASSWORD) {
    die('Access denied. Add ?pwd=heypay2024 to the URL');
}

// Get the debug.log file path
$log_file = dirname(__FILE__) . '/wp-content/debug.log';

if (!file_exists($log_file)) {
    die('debug.log file not found. Make sure WP_DEBUG_LOG is enabled in wp-config.php');
}

// Read the log file
$lines = file($log_file);
$total_lines = count($lines);

// Filter HeyPay logs only
$heypay_logs = array();
foreach ($lines as $line_num => $line) {
    if (stripos($line, 'heypay') !== false) {
        $heypay_logs[] = [
            'line_num' => $line_num + 1,
            'content' => $line
        ];
    }
}

// Get last N lines if requested
$show_lines = isset($_GET['lines']) ? intval($_GET['lines']) : 100;
$recent_lines = array_slice($lines, -$show_lines);

?>
<!DOCTYPE html>
<html>
<head>
    <title>HeyPay Debug Logs</title>
    <style>
        body {
            font-family: monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            color: #4ec9b0;
            border-bottom: 2px solid #4ec9b0;
            padding-bottom: 10px;
        }
        .stats {
            background: #2d2d30;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .stats div {
            display: inline-block;
            margin-right: 20px;
        }
        .filter-buttons {
            margin-bottom: 20px;
        }
        .filter-buttons button {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            margin-right: 10px;
            cursor: pointer;
            border-radius: 3px;
            font-family: monospace;
        }
        .filter-buttons button:hover {
            background: #005a9e;
        }
        .filter-buttons button.active {
            background: #4ec9b0;
        }
        .log-entry {
            padding: 8px;
            margin: 2px 0;
            border-left: 3px solid transparent;
            background: #252526;
            border-radius: 3px;
        }
        .log-entry.heypay {
            border-left-color: #4ec9b0;
            background: #1a3a1a;
        }
        .log-entry.error {
            border-left-color: #f48771;
            background: #3a1a1a;
        }
        .log-entry.success {
            border-left-color: #89d185;
            background: #1a3a1a;
        }
        .line-num {
            color: #858585;
            margin-right: 10px;
        }
        .highlight {
            background: #ffff00;
            color: #000;
            padding: 2px 4px;
        }
        .refresh-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #007acc;
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 50px;
            cursor: pointer;
            font-size: 16px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .refresh-btn:hover {
            background: #005a9e;
        }
        .search-box {
            width: 100%;
            padding: 10px;
            margin-bottom: 20px;
            background: #2d2d30;
            border: 1px solid #3e3e42;
            color: #d4d4d4;
            font-family: monospace;
            font-size: 14px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 HeyPay Debug Logs</h1>

        <div class="stats">
            <div><strong>Total lines:</strong> <?php echo number_format($total_lines); ?></div>
            <div><strong>HeyPay logs:</strong> <?php echo count($heypay_logs); ?></div>
            <div><strong>Showing:</strong> Last <?php echo $show_lines; ?> lines</div>
            <div><strong>File:</strong> <?php echo basename($log_file); ?></div>
        </div>

        <div class="filter-buttons">
            <button onclick="filterLogs('all')" class="active" id="btn-all">All Logs</button>
            <button onclick="filterLogs('heypay')" id="btn-heypay">HeyPay Only</button>
            <button onclick="filterLogs('error')" id="btn-error">Errors Only</button>
            <button onclick="window.location.href='?pwd=<?php echo DEBUG_PASSWORD; ?>&lines=50'">Last 50</button>
            <button onclick="window.location.href='?pwd=<?php echo DEBUG_PASSWORD; ?>&lines=200'">Last 200</button>
            <button onclick="window.location.href='?pwd=<?php echo DEBUG_PASSWORD; ?>&lines=500'">Last 500</button>
            <button onclick="clearLogs()" style="background: #f48771;">Clear Logs</button>
        </div>

        <input type="text" class="search-box" id="searchBox" placeholder="🔍 Search logs... (type to filter)" onkeyup="searchLogs()">

        <div id="logs">
            <?php foreach ($recent_lines as $line_num => $line): ?>
                <?php
                $is_heypay = stripos($line, 'heypay') !== false;
                $is_error = stripos($line, 'error') !== false || stripos($line, '❌') !== false;
                $is_success = stripos($line, '✅') !== false;

                $class = '';
                if ($is_heypay) $class .= ' heypay';
                if ($is_error) $class .= ' error';
                if ($is_success) $class .= ' success';
                ?>
                <div class="log-entry<?php echo $class; ?>" data-type="<?php echo $is_heypay ? 'heypay' : 'other'; ?>">
                    <span class="line-num"><?php echo ($total_lines - $show_lines + $line_num + 1); ?></span>
                    <?php echo htmlspecialchars($line); ?>
                </div>
            <?php endforeach; ?>
        </div>

        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
    </div>

    <script>
        let currentFilter = 'all';

        function filterLogs(type) {
            currentFilter = type;
            const entries = document.querySelectorAll('.log-entry');

            // Update button states
            document.querySelectorAll('.filter-buttons button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.getElementById('btn-' + type).classList.add('active');

            entries.forEach(entry => {
                if (type === 'all') {
                    entry.style.display = 'block';
                } else if (type === 'heypay') {
                    entry.style.display = entry.dataset.type === 'heypay' ? 'block' : 'none';
                } else if (type === 'error') {
                    entry.style.display = entry.classList.contains('error') ? 'block' : 'none';
                }
            });
        }

        function searchLogs() {
            const searchTerm = document.getElementById('searchBox').value.toLowerCase();
            const entries = document.querySelectorAll('.log-entry');

            entries.forEach(entry => {
                const text = entry.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    entry.style.display = 'block';

                    // Highlight search term
                    if (searchTerm.length > 0) {
                        const regex = new RegExp('(' + searchTerm + ')', 'gi');
                        entry.innerHTML = entry.innerHTML.replace(/<span class="highlight">|<\/span>/g, '');
                        entry.innerHTML = entry.innerHTML.replace(regex, '<span class="highlight">$1</span>');
                    }
                } else {
                    entry.style.display = 'none';
                }
            });
        }

        function clearLogs() {
            if (confirm('Are you sure you want to clear all logs? This cannot be undone!')) {
                window.location.href = '?pwd=<?php echo DEBUG_PASSWORD; ?>&action=clear';
            }
        }

        // Auto-refresh every 5 seconds
        setInterval(() => {
            if (confirm('Auto-refresh logs?')) {
                location.reload();
            }
        }, 5000);
    </script>
</body>
</html>

<?php
// Handle clear action
if (isset($_GET['action']) && $_GET['action'] === 'clear' && isset($_GET['pwd']) && $_GET['pwd'] === DEBUG_PASSWORD) {
    file_put_contents($log_file, '');
    header('Location: view-logs.php?pwd=' . DEBUG_PASSWORD);
    exit;
}
?>
