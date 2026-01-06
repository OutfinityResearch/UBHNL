@a:Bit
@b:Bit
@c:Bit

# Simple implication chain (Command Style)
# a implies b
@rule1 implies $a $b
# b implies c
@rule2 implies $b $c

# Assert roots
$rule1
$rule2
