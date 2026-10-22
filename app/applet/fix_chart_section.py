with open('src/components/QCManagement.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's find the start of chart view and table view
chart_start = text.find('{historyViewMode === "chart" && (')
table_start = text.find('{historyViewMode === "table" && (')

print("chart_start:", chart_start, "table_start:", table_start)

if chart_start != -1 and table_start != -1:
    # We want to replace everything between chart_start and table_start with a clean chart view implementation
    # Let's verify what comes right before table_start
    print("Snippet before table_start:", text[table_start-300:table_start])
