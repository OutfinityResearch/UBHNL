@switch1:Switch
@f1 On $switch1
@f2 Off $switch1
$f1
$f2

@rule forall $s Switch begin
    @c1 On $s
    @c2 Off $s
    @both and $c1 $c2
    not $both
end
