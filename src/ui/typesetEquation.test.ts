import { describe, expect, it } from "vitest";
import { flattenEquation as flatten } from "./typesetEquation.test-helper";
import { typesetEquation } from "./typesetEquation";

describe("equation typesetting", () => {
  it.each([
    ["f_n/f_0 = 2^(n/m)", "f_{n}/f_{0} = 2^{n/m}"],
    ["c = 1200 log2(f2/f1)", "c = 1200 log_{2}(f_{2}/f_{1})"],
    ["H(X) = -sum p(x) log2 p(x)", "H(X) = −∑ p(x) log_{2} p(x)"],
    ["r = |N^-1 sum exp(i theta_j)|", "r = |N^{−1} ∑ exp(i θ_{j})|"],
    ["CI_95 = mean +/- 1.96 s/sqrt(n)", "CI_{95} = mean ± 1.96 s/√{n}"],
    ["b_hat = 60 / median(Delta t)", "b̂ = 60 / median(Δ t)"],
    ["P(X_(t+1)=j | X_t=i) = P_ij", "P(X_{t + 1} = j | X_{t} = i) = P_{ij}"],
    ["d_i = observed_i - reference_i", "d_{i} = observed_{i} − reference_{i}"],
    ["L = lcm(p, q) = |pq| / gcd(p, q)", "L = lcm(p, q) = |pq| / gcd(p, q)"],
  ])("sets %s", (source, expected) => {
    expect(flatten(typesetEquation(source))).toBe(expected);
  });
});
