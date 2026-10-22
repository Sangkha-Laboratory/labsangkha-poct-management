with open('src/components/QCManagement.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

chart_start = text.find('{historyViewMode === "chart" && (')
table_start = text.find('{historyViewMode === "table" && (')

print("chart_start:", chart_start, "table_start:", table_start)
if chart_start != -1 and table_start != -1:
    print("Snippet before table_start:", text[table_start-300:table_start])
