#!/bin/bash
BASE="http://localhost:3001"

echo "=========================================="
echo "  偏差处置工单流转模块 - API功能测试"
echo "=========================================="
echo ""

echo "[1] 健康检查"
curl -s $BASE/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('    状态:', d['status'])"

echo ""
echo "[2] 工单模板（4种严重等级）"
curl -s $BASE/api/work-order-templates | python3 -c "
import sys,json
d=json.load(sys.stdin)
for k,v in d.items():
    print(f'    {k}: {v[\"name\"]} | 时限{v[\"timeLimitMinutes\"]}分钟 | {len(v[\"steps\"])}步 | 复核:{\"是\" if v[\"requiresReview\"] else \"否\"} | 默认指派人:{v[\"defaultAssignee\"]}')"

echo ""
echo "[3] 工单列表（demo数据自动生成）"
curl -s "$BASE/api/work-orders?pageSize=10" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'    总数: {d[\"pagination\"][\"total\"]} 个工单')
for wo in d['data']:
    steps_done = sum(1 for s in wo['steps'] if s['completed'])
    print(f'    {wo[\"id\"]} | 状态:{wo[\"status\"]} | 等级:{wo[\"deviationLevel\"]} | 指派人:{wo[\"assignee\"]} | CCP:{wo[\"ccpName\"]} | 步骤:{steps_done}/{len(wo[\"steps\"])}')"

echo ""
echo "[4] 未关闭工单按剩余时间排序"
curl -s "$BASE/api/work-orders/urgent" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'    共 {len(d)} 个未关闭工单')
for wo in d[:3]:
    rm = wo.get('remainingMinutes')
    rm_str = f'{rm}分钟' if rm is not None else '(未接单,不计时)'
    print(f'    {wo[\"id\"]} | 状态:{wo[\"status\"]} | 剩余:{rm_str} | 超时:{wo[\"isOverdue\"]}')"

echo ""
echo "[5] 接单 WO000001"
curl -s -X POST $BASE/api/work-orders/WO000001/accept \
  -H "Content-Type: application/json" \
  -d '{"operator":"张工程师"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'    新状态: {d[\"status\"]}')
print(f'    接单时间: {d[\"acceptedAt\"][:19]}')
print(f'    处置时限: {d[\"timeLimitMinutes\"]}分钟')
print(f'    截止时间: {d[\"deadline\"][:19]}')"

echo ""
echo "[6] 完成步骤1"
curl -s -X POST $BASE/api/work-orders/WO000001/complete-step \
  -H "Content-Type: application/json" \
  -d '{"stepIndex":1,"operator":"张工程师","remark":"到达现场，确认冷却槽温度偏高3.2℃"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
done = sum(1 for s in d['steps'] if s['completed'])
print(f'    状态: {d[\"status\"]} | 完成进度: {done}/{len(d[\"steps\"])}')"

echo ""
echo "[7] 完成步骤2（全部完成后自动进入待复核）"
curl -s -X POST $BASE/api/work-orders/WO000001/complete-step \
  -H "Content-Type: application/json" \
  -d '{"stepIndex":2,"operator":"张工程师","remark":"调整冷凝压力，温度已恢复至6℃（合规范围0-8℃）"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
done = sum(1 for s in d['steps'] if s['completed'])
print(f'    状态: {d[\"status\"]} | 完成进度: {done}/{len(d[\"steps\"])}')
print(f'    指定复核人: {d[\"reviewer\"]}')"

echo ""
echo "[8] 主管复核通过（自动关闭工单并关联关闭偏差）"
curl -s -X POST $BASE/api/work-orders/WO000001/review \
  -H "Content-Type: application/json" \
  -d '{"reviewer":"当班主管","passed":true,"reviewRemark":"处置流程规范，记录完整，同意关闭"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'    最终状态: {d[\"status\"]}')
print(f'    关闭时间: {d[\"closedAt\"][:19]}')
print(f'    操作历史: {len(d[\"operationHistory\"])} 条记录')
for h in d['operationHistory']:
    print(f'      - {h[\"timestamp\"][11:19]} | {h[\"action\"]:20s} | {h[\"operator\"]:10s} | {h[\"remark\"]}')"

echo ""
echo "[9] 个人工单列表查询（当班主管）"
curl -s "$BASE/api/work-orders/assignee/%E5%BD%93%E7%8F%AD%E4%B8%BB%E7%AE%A1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'    操作人: {d[\"assignee\"]} | 总数:{d[\"total\"]} | 未关闭:{d[\"open\"]} | 超时:{d[\"overdue\"]}')"

echo ""
echo "[10] 处置时效统计"
curl -s "$BASE/api/work-orders/statistics" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s = d['summary']
print(f'    === 汇总统计 ===')
print(f'    总工单数: {s[\"total\"]}')
print(f'    已关闭: {s[\"closed\"]} | 处理中: {s[\"open\"]}')
print(f'    平均处置时长: {s[\"avgDurationMinutes\"]} 分钟')
print(f'    超时率: {(s[\"overdueRate\"]*100):.2f}% | 准时率: {(s[\"onTimeRate\"]*100):.2f}%')
print(f'    === 按状态分布 ===')
for k,v in d['byStatus'].items():
    print(f'      {k}: {v}')
print(f'    === 按等级分布 ===')
for k,v in d['byLevel'].items():
    print(f'      {k}: {v}')
if d['monthlyTrend']:
    print(f'    === 月度趋势 ===')
    for m in d['monthlyTrend']:
        print(f'      {m[\"month\"]}: 总数{m[\"total\"]} 已关闭{m[\"closed\"]} 超时{m[\"overdue\"]} 平均{m[\"avgDurationMinutes\"]}分钟')"

echo ""
echo "=========================================="
echo "  测试完成！"
echo "=========================================="
