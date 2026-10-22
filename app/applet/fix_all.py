with open('src/components/QCManagement.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

chart_cond = '{historyViewMode === "chart" && ('
table_cond = '{historyViewMode === "table" && ('

c_idx = text.find(chart_cond)
t_idx = text.find(table_cond)

# Let's find where the first clean chart block ends (right after hoveredPoint tooltip and closing divs of chart view)
# In text, the first levelsToRender.map ends around pos 155000+
# Let's find the first occurrence of `</div\s*>\s*</div>\s*\)\s*\}\s*\(\)\s*\}` or similar after c_idx

# Even simpler: we can take text[:c_idx] + chart_block + text[t_idx:]
# Where chart_block is everything from c_idx to the end of the first valid chart block before the duplication.
# Let's search for the first occurrence of `{historyViewMode === "table" && (` in the duplicated text, wait, table_cond appears once or multiple times?
table_indices = []
pos = 0
while True:
    pos = text.find(table_cond, pos)
    if pos == -1:
        break
    table_indices.append(pos)
    pos += len(table_cond)

print("Table condition indices:", table_indices)
